import { DEFAULT_THEME, THEMES } from "./theme-tokens";

export type Mode = "light" | "dark" | "system";
export type Scale = "compact" | "normal" | "large";

export const STORAGE_KEY = "appearance";

export const SCALES: readonly { id: Scale; label: string; percent: number }[] = [
  { id: "compact", label: "Compact", percent: 90 },
  { id: "normal", label: "Normal", percent: 100 },
  { id: "large", label: "Large", percent: 125 },
];

export type Appearance = { mode: Mode; theme: string; scale: Scale };

export const DEFAULT_APPEARANCE: Appearance = { mode: "system", theme: DEFAULT_THEME, scale: "normal" };

export function applyAppearance({ mode, theme, scale }: Appearance) {
  const root = document.documentElement;
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.theme = THEMES.some((t) => t.id === theme) ? theme : DEFAULT_THEME;
  root.dataset.scale = scale;
}

/** Runs before first paint, so the stored look never flashes. Mirrors applyAppearance. */
export const PREPAINT_SCRIPT = `(function(){var a={};try{a=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))||{}}catch(e){}var r=document.documentElement,m=a.mode||"system";r.classList.toggle("dark",m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches));r.dataset.theme=${JSON.stringify(THEMES.map((t) => t.id))}.indexOf(a.theme)>=0?a.theme:${JSON.stringify(DEFAULT_THEME)};r.dataset.scale=a.scale==="compact"||a.scale==="large"?a.scale:"normal"})()`;
