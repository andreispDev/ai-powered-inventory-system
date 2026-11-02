"use client";

import { useAppearance } from "@/components/providers/appearance-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FONTS, SCALES, type Mode } from "@/lib/appearance";
import { oklchToCss, THEMES } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

const MODES: { id: Mode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function AppearanceSettings() {
  const { mode, theme, scale, font, update } = useAppearance();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Button
              key={m.id}
              variant={mode === m.id ? "default" : "outline"}
              aria-pressed={mode === m.id}
              onClick={() => update({ mode: m.id })}
            >
              {m.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UI scale</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SCALES.map((s) => (
            <Button
              key={s.id}
              variant={scale === s.id ? "default" : "outline"}
              aria-pressed={scale === s.id}
              onClick={() => update({ scale: s.id })}
            >
              {s.label} ({s.percent}%)
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Font</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={font === f.id}
              onClick={() => update({ font: f.id })}
              style={{ fontFamily: f.variable }}
              className={cn(
                "hover:bg-accent shadow-card rounded-lg border px-3 py-3 text-left transition-colors duration-[var(--motion-fast)]",
                font === f.id && "border-ring ring-ring ring-1",
              )}
            >
              <span className="block text-2xl font-semibold">Aa</span>
              <span className="text-sm">{f.label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color theme</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              onClick={() => update({ theme: t.id })}
              className={cn(
                "hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors duration-[var(--motion-fast)]",
                theme === t.id && "border-ring ring-ring ring-1",
              )}
            >
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full border"
                style={{ backgroundColor: oklchToCss(t.primary.light) }}
              />
              {t.label}
            </button>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
