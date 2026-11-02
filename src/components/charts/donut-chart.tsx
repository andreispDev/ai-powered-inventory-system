"use client";

import { useState } from "react";

export type DonutSlice = { label: string; value: number };

// One hue, from strongest to faintest. Mixed with the card color, so it follows every theme and mode.
const SHADES = [100, 78, 58, 40, 26];
const MAX_SLICES = SHADES.length;

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 1.6;

const shade = (index: number) => `color-mix(in oklch, var(--primary) ${SHADES[index]}%, var(--card))`;

/** Keeps the largest slices and folds the rest into "Other", so shades stay easy to tell apart. */
export function foldSlices(slices: readonly DonutSlice[]): DonutSlice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;
  const kept = sorted.slice(0, MAX_SLICES - 1);
  const other = sorted.slice(MAX_SLICES - 1).reduce((sum, slice) => sum + slice.value, 0);
  // Empty rows only pad the legend, so they don't earn an "Other".
  return other > 0 ? [...kept, { label: "Other", value: other }] : sorted.slice(0, MAX_SLICES);
}

export function DonutChart({ slices, totalLabel, empty }: { slices: readonly DonutSlice[]; totalLabel: string; empty: string }) {
  const [active, setActive] = useState<number | null>(null);
  const data = foldSlices(slices);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const single = data.filter((slice) => slice.value > 0).length === 1;
  const segments = data.flatMap((slice, index) => {
    if (slice.value === 0) return [];
    const length = (slice.value / total) * CIRCUMFERENCE;
    const before = data.slice(0, index).reduce((sum, earlier) => sum + earlier.value, 0);
    return [
      {
        index,
        length: single ? length : Math.max(length - GAP, 0.5),
        offset: (before / total) * CIRCUMFERENCE,
      },
    ];
  });
  const shown = active === null ? null : data[active];
  const percent = (value: number) => `${total === 0 ? 0 : Math.round((value / total) * 100)}%`;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-36 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          role="img"
          aria-label={`${totalLabel}: ${total}. ${data.map((slice) => `${slice.label} ${slice.value}`).join(", ")}.`}
        >
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={13} className="stroke-muted" />
          {segments.map((segment) => (
            <circle
              key={segment.index}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth={active === segment.index ? 15 : 13}
              stroke={shade(segment.index)}
              strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
              strokeDashoffset={-segment.offset}
              className="transition-[stroke-width] duration-[var(--motion-fast)]"
              onMouseEnter={() => setActive(segment.index)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-xl leading-tight font-semibold tabular-nums">{(shown?.value ?? total).toLocaleString()}</span>
          <span className="text-muted-foreground line-clamp-2 text-[0.6875rem] leading-tight">{shown?.label ?? totalLabel}</span>
        </div>
      </div>
      <ul className="min-w-36 flex-1 space-y-1.5 text-sm">
        {data.length === 0 && (
          <li className="text-muted-foreground flex items-center gap-2">
            <span className="bg-muted size-2.5 shrink-0 rounded-sm" aria-hidden />
            {empty}
          </li>
        )}
        {data.map((slice, index) => (
          <li
            key={slice.label}
            className="flex items-center gap-2"
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: shade(index) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="font-medium tabular-nums">{slice.value.toLocaleString()}</span>
            <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{percent(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
