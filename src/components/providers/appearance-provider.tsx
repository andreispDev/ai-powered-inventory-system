"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { applyAppearance, DEFAULT_APPEARANCE, STORAGE_KEY, type Appearance } from "@/lib/appearance";

type Value = Appearance & { update: (next: Partial<Appearance>) => void };

const AppearanceContext = createContext<Value | null>(null);

function readStored(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);

  useEffect(() => {
    // The pre-paint script already styled the page; this only syncs React state to storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppearance(readStored());
  }, []);

  useEffect(() => {
    if (appearance.mode !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(appearance);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [appearance]);

  const update = useCallback((next: Partial<Appearance>) => {
    const merged = { ...readStored(), ...next };
    setAppearance(merged);
    applyAppearance(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Private windows can block storage. The choice still applies for this page.
    }
  }, []);

  return <AppearanceContext value={{ ...appearance, update }}>{children}</AppearanceContext>;
}

export function useAppearance() {
  const value = use(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
