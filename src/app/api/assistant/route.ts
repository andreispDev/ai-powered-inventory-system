import { and, asc, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { answerQuestion, type AgentEvent } from "@/modules/assistant/agent";
import { waitForTurn } from "@/modules/assistant/turns";
import { runTool, toolSchemas, toolsFor, type Source } from "@/modules/assistant/tools";
import { createOllamaChat, OllamaError } from "@/server/ai/ollama";
import { writeAudit } from "@/server/audit/writer";
import { actorFromHeaders } from "@/server/auth/session";
import { aiConversation, aiMessage } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

const DAILY_LIMIT = 50;
const HISTORY_TURNS = 6;

const body = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationId: z.uuid().optional(),
});

const fail = (status: number, message: string) => Response.json({ message }, { status });

/** Browsers send Origin on POST. A page on another site must not be able to spend someone's questions. */
const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !!origin && new URL(origin).host === request.headers.get("host");
};

export async function GET(request: Request) {
  const actor = await actorFromHeaders(request.headers);
  if (!actor) return fail(401, "Sign in again.");
  if (!actor.permissions.includes("ai.chat")) return fail(403, "You don't have access to the assistant.");
  const parsed = z.uuid().safeParse(new URL(request.url).searchParams.get("conversation"));
  if (!parsed.success) return fail(400, "Unknown conversation.");
  // RLS limits both tables to the signed-in person.
  const messages = await readScoped(actor, (tx) =>
    tx
      .select({ id: aiMessage.id, role: aiMessage.role, content: aiMessage.content, sources: aiMessage.sources })
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, parsed.data))
      .orderBy(asc(aiMessage.createdAt)),
  );
  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "This request isn't allowed.");
  const actor = await actorFromHeaders(request.headers);
  if (!actor) return fail(401, "Sign in again.");
  if (!actor.permissions.includes("ai.chat")) return fail(403, "You don't have access to the assistant.");

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Enter a question of up to 1,000 characters.");
  const { message } = parsed.data;

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const prepared = await readScoped(actor, async (tx) => {
    const [{ asked }] = await tx
      .select({ asked: count() })
      .from(aiMessage)
      .where(and(eq(aiMessage.role, "user"), eq(aiMessage.userId, actor.id), gte(aiMessage.createdAt, dayStart)));
    if (asked >= DAILY_LIMIT) return { limited: true as const };

    let conversationId = parsed.data.conversationId;
    if (conversationId) {
      const [own] = await tx.select({ id: aiConversation.id }).from(aiConversation).where(eq(aiConversation.id, conversationId));
      if (!own) return { missing: true as const };
    } else {
      const [created] = await tx
        .insert(aiConversation)
        .values({ userId: actor.id, officeId: actor.officeId, title: message.slice(0, 80) })
        .returning({ id: aiConversation.id });
      conversationId = created.id;
    }
    const earlier = await tx
      .select({ role: aiMessage.role, content: aiMessage.content })
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, conversationId))
      .orderBy(asc(aiMessage.createdAt));
    await tx.insert(aiMessage).values({ conversationId, userId: actor.id, officeId: actor.officeId, role: "user", content: message });
    return { conversationId, history: earlier.slice(-HISTORY_TURNS) as { role: "user" | "assistant"; content: string }[] };
  });
  if ("limited" in prepared) return fail(429, `You've reached today's limit of ${DAILY_LIMIT} questions.`);
  if ("missing" in prepared) return fail(404, "That conversation wasn't found.");
  const { conversationId, history } = prepared;

  const tools = toolsFor(actor.permissions);
  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent | { type: string; [key: string]: unknown }) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The person left. The answer is still saved below.
        }
      };
      let answer = "";
      let sources: Source[] = [];
      let consulted: { tool: string; args: unknown }[] = [];
      let usage = { promptTokens: 0, completionTokens: 0 };
      let status = "answered";

      send({ type: "start", conversationId });
      const release = await waitForTurn((ahead) => send({ type: "status", text: `Waiting for ${ahead} ${ahead === 1 ? "question" : "questions"} ahead of yours…` }), request.signal);
      try {
        send({ type: "status", text: "Thinking…" });
        const result = await answerQuestion({
          model: createOllamaChat(),
          question: message,
          history,
          tools: toolSchemas(tools),
          toolNames: tools.map((tool) => tool.name),
          // A transaction per tool, never held open while the model is thinking.
          runTool: (name, args) => readScoped(actor, (tx) => runTool({ tx, permissions: actor.permissions, now: new Date() }, name, args)),
          emit: send,
          signal: request.signal,
          today: now.toISOString().slice(0, 10),
          scopeLabel: actor.officeName ?? "all offices",
        });
        ({ sources, consulted, usage } = result);
        answer = result.answer || "I couldn't find an answer to that.";
        if (!result.answer) send({ type: "token", text: answer });
        send({ type: "done", sources });
      } catch (error) {
        status = request.signal.aborted ? "stopped" : "failed";
        if (!request.signal.aborted) {
          console.error("Assistant:", String(error));
          send({
            type: "error",
            message: error instanceof OllamaError ? "The AI isn't available right now. The rest of the app still works." : "Something went wrong answering that. Please try again.",
          });
        }
      } finally {
        release();
        // Every question is on the record, including ones that failed.
        await readScoped(actor, async (tx) => {
          if (answer) {
            await tx.insert(aiMessage).values({
              conversationId,
              userId: actor.id,
              officeId: actor.officeId,
              role: "assistant",
              content: answer,
              sources,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              durationMs: Date.now() - started,
            });
          }
          await tx.update(aiConversation).set({ updatedAt: new Date() }).where(eq(aiConversation.id, conversationId));
          await writeAudit(tx, {
            actor,
            action: "ai.asked",
            entityType: "ai_conversation",
            entityId: conversationId,
            after: { question: message, consulted, answer, status },
          });
        }).catch((error) => console.error("Assistant log:", String(error)));
        try {
          controller.close();
        } catch {
          // Already closed by the person leaving.
        }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
