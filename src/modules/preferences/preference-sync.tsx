"use client";

import { useEffect, useRef } from "react";
import { useAppearance } from "@/components/providers/appearance-provider";
import type { Appearance } from "@/lib/appearance";
import { savePreferences } from "./actions";

/** Applies the account's saved look on sign-in, then saves later changes so they follow the person. */
export function PreferenceSync({ saved }: { saved: Appearance | null }) {
  const { mode, theme, scale, update } = useAppearance();
  const lastSynced = useRef<string | null>(null);
  const applied = useRef(false);

  useEffect(() => {
    if (!applied.current) {
      applied.current = true;
      if (saved) {
        lastSynced.current = JSON.stringify({ mode: saved.mode, theme: saved.theme, scale: saved.scale });
        update(saved);
        return;
      }
    }
    const current = JSON.stringify({ mode, theme, scale });
    if (current === lastSynced.current) return;
    // The provider starts on defaults until it reads storage, so wait before treating this as a change.
    const timer = setTimeout(() => {
      lastSynced.current = current;
      void savePreferences({ mode, theme, scale }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [mode, theme, scale, saved, update]);

  return null;
}
