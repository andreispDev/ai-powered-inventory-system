"use client";

import { CheckCircle2, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type Connection = "online" | "offline" | "unreachable";

const HEARTBEAT_MS = 30_000;
/** Ignores short blips */
const GRACE_MS = 2_000;

let state: Connection = "online";
let lastGoodAt: number | null = null;
const listeners = new Set<() => void>();

function publish(next: Connection) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

async function check(): Promise<Connection> {
  if (!navigator.onLine) return "offline";
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return "unreachable";
    lastGoodAt = Date.now();
    return "online";
  } catch {
    return "unreachable";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size > 1) return () => void listeners.delete(listener);

  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    clearTimeout(graceTimer);
    const first = await check();
    if (first === "online") return publish("online");
    // Confirm after the grace period before telling anyone.
    graceTimer = setTimeout(async () => publish(await check()), GRACE_MS);
  };
  const interval = setInterval(run, HEARTBEAT_MS);
  window.addEventListener("online", run);
  window.addEventListener("offline", run);
  void run();

  return () => {
    listeners.delete(listener);
    clearTimeout(graceTimer);
    clearInterval(interval);
    window.removeEventListener("online", run);
    window.removeEventListener("offline", run);
  };
}

export function useConnection(): Connection {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => "online",
  );
}

const LABEL: Record<Connection, string> = { online: "Live", offline: "Offline", unreachable: "Reconnecting" };

export function ConnectionIndicator() {
  const connection = useConnection();
  const online = connection === "online";
  return (
    <span className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs" role="status">
      <span aria-hidden className={`size-2 rounded-full ${online ? "bg-success" : "bg-warning"}`} />
      {LABEL[connection]}
    </span>
  );
}

export function OfflineBanner() {
  const connection = useConnection();
  const wasDown = useRef(false);
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    if (connection !== "online") {
      wasDown.current = true;
      return;
    }
    if (!wasDown.current) return;
    wasDown.current = false;
    setBackOnline(true);
    const timer = setTimeout(() => setBackOnline(false), 3_000);
    return () => clearTimeout(timer);
  }, [connection]);

  if (connection === "online" && !backOnline) return null;

  if (connection === "online") {
    return (
      <div role="status" className="bg-success-subtle text-success flex items-center gap-2 px-4 py-2 text-sm">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Back online.
      </div>
    );
  }

  const since = lastGoodAt
    ? new Date(lastGoodAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div role="alert" className="bg-warning-subtle text-warning flex items-center gap-2 px-4 py-2 text-sm">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {connection === "offline" ? "You're offline." : "Can't reach the server."}
      {since ? ` Showing data from ${since}.` : ""} Changes are paused.
    </div>
  );
}
