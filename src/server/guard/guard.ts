import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { writeAudit, type AuditEntry } from "../audit/writer";
import { getActor, scopeOf, type Actor } from "../auth/session";
import type { Permission } from "../authz/catalog";
import { getDb } from "../db/client";
import { idempotencyKey, outbox } from "../db/schema";
import { runScoped, type ScopedTx } from "../db/scope";
import { checkLimit } from "../rate-limit";
import type { LimitClass } from "../rate-limit/limits";
import { AppError, type ActionResult } from "./errors";

type Context<I> = {
  input: I;
  actor: Actor;
  tx: ScopedTx;
  /** Records the change in this transaction */
  audit: (entry: Omit<AuditEntry, "actor" | "requestId" | "ip">) => Promise<void>;
  /** Queues an event in this transaction, so it's sent only if the change commits */
  emit: (topic: string, payload: Record<string, unknown>) => Promise<void>;
};

/**
 * The only way to write a mutation. Runs session, status, rate limit, permission, validation,
 * then a scoped transaction, so the change and its audit entry succeed or fail together.
 */
export function guard<S extends z.ZodType, R>(config: {
  /** null means any signed-in person, for their own settings */
  permission: Permission | null;
  input: S;
  rateLimit?: LimitClass;
  run: (ctx: Context<z.output<S>>) => Promise<R>;
}) {
  return async (raw: z.input<S>, retryKey?: string): Promise<ActionResult<R>> => {
    try {
      const actor = await getActor();
      if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in again.");

      const limit = await checkLimit(config.rateLimit ?? "write", actor.id);
      if (!limit.ok) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many requests.",
          retryAfterSeconds: limit.retryAfterSeconds,
        };
      }

      if (config.permission && !actor.permissions.includes(config.permission)) {
        throw new AppError("FORBIDDEN", "You don't have permission to do this.");
      }

      const parsed = config.input.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Please check the highlighted fields.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }

      const requestHeaders = await headers();
      const requestId = requestHeaders.get("x-request-id");
      const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      const data = await runScoped(getDb(), scopeOf(actor), async (tx) => {
        // A retry of the same submission returns the first result instead of applying it twice.
        if (retryKey) {
          const [claimed] = await tx
            .insert(idempotencyKey)
            .values({ userId: actor.id, key: retryKey })
            .onConflictDoNothing()
            .returning({ key: idempotencyKey.key });
          if (!claimed) {
            const [first] = await tx
              .select({ result: idempotencyKey.result })
              .from(idempotencyKey)
              .where(and(eq(idempotencyKey.userId, actor.id), eq(idempotencyKey.key, retryKey)));
            return first?.result as R;
          }
        }

        const result = await config.run({
          input: parsed.data,
          actor,
          tx,
          audit: async (entry) => {
            await writeAudit(tx, { ...entry, actor, requestId, ip });
            const officeId = entry.officeId === undefined ? actor.officeId : entry.officeId;
            await tx.insert(outbox).values({
              topic: "activity",
              officeId,
              payload: {
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                actorName: actor.name,
                at: new Date().toISOString(),
              },
            });
          },
          emit: async (topic, payload) => {
            await tx.insert(outbox).values({ topic, payload, officeId: actor.officeId });
          },
        });

        if (retryKey) {
          await tx
            .update(idempotencyKey)
            .set({ result: result ?? null })
            .where(and(eq(idempotencyKey.userId, actor.id), eq(idempotencyKey.key, retryKey)));
        }
        return result;
      });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors };
      }
      console.error(error);
      return { ok: false, code: "INTERNAL", message: "Something went wrong. Your changes weren't saved." };
    }
  };
}
