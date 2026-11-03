"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useAppearance } from "@/components/providers/appearance-provider";
import { Button } from "@/components/ui/button";

// Follows the page itself, so it's right even when the mode comes from the device setting.
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const { update } = useAppearance();
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const next = dark ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => update({ mode: next })}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
