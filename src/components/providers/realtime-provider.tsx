"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type RealtimeEvent = { type: "notification" | "activity"; data: Record<string, unknown> };
type Listener = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<{ subscribe: (listener: Listener) => () => void; live: boolean } | null>(null);

/** One connection per page. EventSource reconnects by itself and resumes from the last event. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [live, setLive] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    // Only connect once a session is confirmed, so signed-out pages don't retry forever.
    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => {
        if (cancelled || !response.ok) return;
        source = new EventSource("/api/events");
        source.onopen = () => setLive(true);
        source.onerror = () => setLive(false);
        const relay = (type: RealtimeEvent["type"]) => (message: MessageEvent<string>) => {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(message.data);
          } catch {
            // An event with a bad body still signals that something changed.
          }
          listeners.current.forEach((listener) => listener({ type, data }));
        };
        source.addEventListener("notification", relay("notification"));
        source.addEventListener("activity", relay("activity"));
        source.addEventListener("session-ended", () => {
          source?.close();
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login";
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      source?.close();
      setLive(false);
    };
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);

  return <RealtimeContext value={{ subscribe, live }}>{children}</RealtimeContext>;
}

export function useRealtime(listener?: Listener) {
  const value = use(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used inside RealtimeProvider");
  const { subscribe, live } = value;
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => subscribe((event) => latest.current?.(event)), [subscribe]);
  return { live };
}
