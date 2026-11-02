import { desc, asc, eq } from "drizzle-orm";
import { History, MessageSquarePlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { param, type SearchParams } from "@/lib/pagination";
import { AssistantChat, type ChatEntry } from "@/modules/assistant/assistant-chat";
import { requireActor } from "@/server/auth/session";
import { aiConversation, aiMessage } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Assistant" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("ai.chat")) return <AccessDenied />;
  const requested = param(await searchParams, "conversation");
  const current = z.uuid().safeParse(requested).success ? requested : undefined;
  if (requested && !current) notFound();

  // RLS limits conversations to the signed-in person.
  const { conversations, messages } = await readScoped(actor, async (tx) => ({
    conversations: await tx.select({ id: aiConversation.id, title: aiConversation.title }).from(aiConversation).orderBy(desc(aiConversation.updatedAt)).limit(30),
    messages: current
      ? await tx
          .select({ id: aiMessage.id, role: aiMessage.role, content: aiMessage.content, sources: aiMessage.sources })
          .from(aiMessage)
          .where(eq(aiMessage.conversationId, current))
          .orderBy(asc(aiMessage.createdAt))
      : [],
  }));
  if (current && !conversations.some((row) => row.id === current) && messages.length === 0) notFound();

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Assistant"
        description="Answers from your inventory records. It runs on your own computer, and only reads what you can see."
        actions={
          <Button variant="outline" asChild>
            <Link href="/assistant">
              <MessageSquarePlus aria-hidden />
              New chat
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle icon={History}>History</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Your questions will appear here.</p>
            ) : (
              <ul className="-mx-2 max-h-48 space-y-0.5 overflow-y-auto text-sm lg:max-h-[28rem]">
                {conversations.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/assistant?conversation=${row.id}`}
                      aria-current={row.id === current ? "page" : undefined}
                      className={`hover:bg-muted block truncate rounded-md px-2 py-1.5 ${row.id === current ? "bg-muted font-medium" : ""}`}
                    >
                      {row.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="h-[38rem] gap-0 overflow-hidden py-0">
          {/* Remounts for each conversation, so one's draft and messages never show in another. */}
          <AssistantChat key={current ?? "new"} conversationId={current} initialMessages={messages as ChatEntry[]} onPage />
        </Card>
      </div>
    </PageContainer>
  );
}

export default function AssistantPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
