"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signOut } from "@/lib/auth-client";
import { IDLE_WARNING_MS } from "@/server/auth/idle";

const STORAGE_KEY = "last-activity";
const HEARTBEAT_MS = 60_000;
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

const readShared = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Signs out after the set time with no activity in any tab. The server enforces the same limit. */
export function IdleGuard({ minutes }: { minutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(0);
  const lastBeat = useRef(0);
  const warning = useRef(false);
  const ending = useRef(false);
  // A Developer can change this while the page is open.
  const limit = useRef(minutes * 60_000);
  useEffect(() => {
    limit.current = minutes * 60_000;
  }, [minutes]);

  const beat = () => {
    lastBeat.current = Date.now();
    fetch("/api/session/activity", { method: "POST" }).catch(() => {
      // Offline for now. The next activity tries again.
      lastBeat.current = 0;
    });
  };

  const markActive = () => {
    lastActivity.current = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(lastActivity.current));
    } catch {
      // Blocked storage only means other tabs don't share this.
    }
    if (Date.now() - lastBeat.current >= HEARTBEAT_MS) beat();
  };

  useEffect(() => {
    markActive();
    const onActivity = () => {
      // Once the warning is up, only the button counts, so a bumped mouse doesn't dismiss it unread.
      if (!warning.current) markActive();
    };
    for (const name of EVENTS) window.addEventListener(name, onActivity, { passive: true });

    const tick = setInterval(() => {
      const idle = Date.now() - Math.max(lastActivity.current, readShared());
      if (idle >= limit.current) {
        if (ending.current) return;
        ending.current = true;
        void fetch("/api/session/activity", { method: "DELETE" })
          .catch(() => {})
          .finally(() => signOut("/login?reason=idle"));
      } else if (idle >= limit.current - IDLE_WARNING_MS) {
        warning.current = true;
        setSecondsLeft(Math.ceil((limit.current - idle) / 1000));
      } else if (warning.current) {
        // Someone stayed active in another tab.
        warning.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      for (const name of EVENTS) window.removeEventListener(name, onActivity);
    };
    // Runs once. The helpers only use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stay() {
    warning.current = false;
    setSecondsLeft(null);
    lastBeat.current = 0;
    markActive();
  }

  return (
    <Dialog open={secondsLeft !== null} onOpenChange={(open) => !open && stay()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            You&apos;ll be signed out in {secondsLeft} {secondsLeft === 1 ? "second" : "seconds"} because this account has been idle. Unsaved changes on this page would be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={stay}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
