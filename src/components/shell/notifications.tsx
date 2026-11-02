"use client";

import { Bell, Megaphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { acknowledge, markAllRead, markRead } from "@/modules/notifications/actions";

type Summary = {
  unread: number;
  latest: { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }[];
  urgent: { id: string; title: string; body: string | null; link: string | null }[];
};

const EMPTY: Summary = { unread: 0, latest: [], urgent: [] };
const POLL_MS = 60_000;

let shared: Summary = EMPTY;
const subscribers = new Set<(summary: Summary) => void>();

function useSummary() {
  const router = useRouter();
  const [summary, setSummary] = useState(shared);

  useEffect(() => {
    subscribers.add(setSummary);
    return () => void subscribers.delete(setSummary);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      shared = await response.json();
      subscribers.forEach((notify) => notify(shared));
      // A permission change should update menus and pages right away.
      if (shared.latest[0]?.kind === "permission" && !shared.latest[0].readAt) router.refresh();
    } catch {
      // Offline. The next event or poll will catch up.
    }
  }, [router]);

  return { summary, refresh };
}

export function NotificationBell() {
  const { summary, refresh } = useSummary();
  const [open, setOpen] = useState(false);

  useRealtime((event) => {
    if (event.type === "notification") void refresh();
  });

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={summary.unread ? `Notifications, ${summary.unread} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {summary.unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-medium tabular-nums">
              {summary.unread > 99 ? "99+" : summary.unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {summary.unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await markAllRead({});
                void refresh();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        {summary.latest.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {summary.latest.map((note) => {
              const content = (
                <>
                  <span className={`block text-sm ${note.readAt ? "" : "font-medium"}`}>{note.title}</span>
                  {note.body && <span className="text-muted-foreground block truncate text-xs">{note.body}</span>}
                </>
              );
              const onOpen = async () => {
                setOpen(false);
                if (!note.readAt) await markRead({ id: note.id });
                void refresh();
              };
              return (
                <li key={note.id}>
                  {note.link ? (
                    <Link href={note.link} onClick={onOpen} className="hover:bg-accent block px-3 py-2">
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={onOpen} className="hover:bg-accent block w-full px-3 py-2 text-left">
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t p-1">
          <Button variant="ghost" size="sm" className="w-full" asChild onClick={() => setOpen(false)}>
            <Link href="/notifications">See all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Stays on screen until the person acknowledges it. */
export function UrgentBanner() {
  const { summary, refresh } = useSummary();
  if (summary.urgent.length === 0) return null;
  return (
    <div className="space-y-px">
      {summary.urgent.map((note) => (
        <div key={note.id} role="alert" className="bg-warning-subtle text-warning flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
          <Megaphone className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{note.title}</span>
            {note.body ? ` ${note.body}` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await acknowledge({ id: note.id });
              void refresh();
            }}
          >
            Got it
          </Button>
        </div>
      ))}
    </div>
  );
}
