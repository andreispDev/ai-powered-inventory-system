"use client";

import { ArrowUp, Bot, ExternalLink, Sparkles, Square, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConnection } from "@/components/connectivity/connectivity";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatEntry = { id: string; role: string; content: string; sources?: { label: string; href: string }[] | null };

const SUGGESTIONS = ["How many items do we have by category?", "What is out of stock?", "What will run out soon?", "What was issued in the last 30 days?"];

// Only links the app itself made, to its own pages.
const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

export function AssistantChat({
  conversationId: initialConversation,
  initialMessages = [],
  onPage = false,
}: {
  conversationId?: string;
  initialMessages?: ChatEntry[];
  onPage?: boolean;
}) {
  const router = useRouter();
  const connection = useConnection();
  const [conversationId, setConversationId] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const busy = abort.current !== null && status !== null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);
  useEffect(() => () => abort.current?.abort(), []);

  const updateLast = (change: (entry: ChatEntry) => ChatEntry) => setMessages((all) => [...all.slice(0, -1), change(all[all.length - 1])]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setDraft("");
    setError(null);
    setStatus("Thinking…");
    setMessages((all) => [...all, { id: crypto.randomUUID(), role: "user", content: text }, { id: crypto.randomUUID(), role: "assistant", content: "" }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const { message } = (await response.json().catch(() => ({ message: null }))) as { message: string | null };
        throw new Error(message ?? "The assistant isn't available right now.");
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "start") setConversationId(event.conversationId);
          if (event.type === "status") setStatus(event.text);
          if (event.type === "reset") updateLast((entry) => ({ ...entry, content: "" }));
          if (event.type === "token") {
            setStatus(null);
            updateLast((entry) => ({ ...entry, content: entry.content + event.text }));
          }
          if (event.type === "done") updateLast((entry) => ({ ...entry, sources: event.sources }));
          if (event.type === "error") setError(event.message);
        }
      }
      if (onPage) router.refresh();
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      abort.current = null;
      setStatus(null);
      setMessages((all) => (all[all.length - 1]?.content === "" ? all.slice(0, -1) : all));
    }
  }

  const offline = connection !== "online";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Ask about your inventory</p>
              <p className="text-muted-foreground mt-1 text-sm">Answers come from records you can see. It can only read, never change anything.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5" disabled={offline} onClick={() => ask(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((entry) =>
          entry.content === "" ? null : (
            <div key={entry.id} className={`flex gap-2.5 ${entry.role === "user" ? "flex-row-reverse" : ""}`}>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${entry.role === "user" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {entry.role === "user" ? <UserRound className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
              </span>
              <div className={`max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2 text-sm ${entry.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {/* Plain text on purpose: the model can't produce links, images or markup here. */}
                <p className="break-words whitespace-pre-wrap">{entry.content}</p>
                {entry.sources && entry.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                    {entry.sources.filter((source) => isInternal(source.href)).map((source) => (
                      <Link key={source.href} href={source.href} className="bg-background inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:underline">
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{source.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {status && (
          <p role="status" className="text-muted-foreground flex items-center gap-2 pl-9 text-sm">
            <span className="bg-primary size-2 animate-pulse rounded-full" aria-hidden />
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <Textarea
          aria-label="Your question"
          placeholder={offline ? "You're offline." : "Ask a question…"}
          className="max-h-32 min-h-9 resize-none"
          rows={1}
          maxLength={1000}
          value={draft}
          disabled={offline}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(draft);
            }
          }}
        />
        {status !== null || abort.current ? (
          <Button type="button" variant="outline" size="icon" aria-label="Stop" onClick={() => abort.current?.abort()}>
            <Square aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim() || offline}>
            <ArrowUp aria-hidden />
          </Button>
        )}
      </form>
    </div>
  );
}
