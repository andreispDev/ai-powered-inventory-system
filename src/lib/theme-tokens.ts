// Source of truth for every color theme. `npm run themes` writes src/styles/themes.css,
// and tests/theme-contrast.test.ts checks the same values.

export type Oklch = readonly [lightness: number, chroma: number, hue: number];

export type ThemeSeed = {
  id: string;
  label: string;
  family: "neutral" | "accent";
  /** Chroma and hue of the grays */
  gray: readonly [chroma: number, hue: number];
  primary: { light: Oklch; dark: Oklch; lightText: Oklch; darkText: Oklch };
};

const WHITE: Oklch = [0.985, 0, 0];
const INK: Oklch = [0.2, 0.02, 265];

const accent = (
  id: string,
  label: string,
  light: Oklch,
  dark: Oklch,
  darkText: Oklch = INK,
  lightText: Oklch = WHITE,
): ThemeSeed => ({
  id,
  label,
  family: "accent",
  gray: [0.004, 264],
  primary: { light, dark, lightText, darkText },
});

const neutral = (id: string, label: string, chroma: number, hue: number): ThemeSeed => ({
  id,
  label,
  family: "neutral",
  gray: [chroma, hue],
  primary: {
    light: [0.24, chroma * 2, hue],
    dark: [0.92, chroma, hue],
    lightText: WHITE,
    darkText: [0.2, chroma, hue],
  },
});

export const THEMES: readonly ThemeSeed[] = [
  // Slate is the default: cool grays with a restrained blue primary.
  {
    ...neutral("slate", "Slate", 0.012, 255),
    primary: { light: [0.5, 0.15, 258], dark: [0.72, 0.13, 255], lightText: WHITE, darkText: INK },
  },
  neutral("zinc", "Zinc", 0.005, 286),
  neutral("stone", "Stone", 0.006, 60),
  neutral("gray", "Gray", 0.008, 264),
  neutral("neutral", "Neutral", 0, 0),
  accent("blue", "Blue", [0.5, 0.2, 262], [0.7, 0.16, 255]),
  accent("violet", "Violet", [0.5, 0.22, 293], [0.72, 0.16, 293]),
  accent("green", "Green", [0.47, 0.13, 150], [0.75, 0.17, 150]),
  accent("orange", "Orange", [0.5, 0.16, 45], [0.75, 0.17, 55]),
  accent("rose", "Rose", [0.5, 0.2, 15], [0.72, 0.17, 12]),
  accent("red", "Red", [0.5, 0.2, 27], [0.71, 0.17, 25]),
  accent("yellow", "Yellow", [0.82, 0.17, 90], [0.84, 0.16, 92], INK, INK),
];

export const DEFAULT_THEME = "slate";

type Mode = "light" | "dark";

/** Every semantic color for one theme and mode, as [L, C, H] */
export function themeTokens(theme: ThemeSeed, mode: Mode): Record<string, Oklch> {
  const [c, h] = theme.gray;
  const g = (l: number, scale = 1): Oklch => [l, c * scale, h];
  const dark = mode === "dark";
  const primary = dark ? theme.primary.dark : theme.primary.light;
  const primaryText = dark ? theme.primary.darkText : theme.primary.lightText;
  const surface = dark ? g(0.15) : g(1, 0);
  const raised = dark ? g(0.19) : g(1, 0);
  const text = dark ? g(0.97) : g(0.17);
  const quiet = dark ? g(0.25) : g(0.965);
  const muted = dark ? g(0.72) : g(0.48);
  const line = dark ? g(0.29) : g(0.91);
  const control = dark ? g(0.44) : g(0.62);
  // Pale primaries like yellow can't mark focus on a white page, so the ring falls back to text color.
  const ring = contrast(primary, surface) >= 3 ? primary : text;

  return {
    background: surface,
    foreground: text,
    card: raised,
    "card-foreground": text,
    popover: raised,
    "popover-foreground": text,
    primary,
    "primary-foreground": primaryText,
    secondary: quiet,
    "secondary-foreground": text,
    muted: quiet,
    "muted-foreground": muted,
    accent: quiet,
    "accent-foreground": text,
    destructive: dark ? [0.7, 0.19, 22] : [0.5, 0.2, 27],
    "destructive-foreground": dark ? [0.2, 0.02, 25] : WHITE,
    border: line,
    input: control,
    ring,
    // Status colors keep their meaning in every theme.
    success: dark ? [0.76, 0.16, 150] : [0.45, 0.12, 150],
    "success-subtle": dark ? [0.27, 0.05, 150] : [0.96, 0.03, 150],
    warning: dark ? [0.8, 0.15, 80] : [0.48, 0.1, 70],
    "warning-subtle": dark ? [0.28, 0.05, 80] : [0.96, 0.04, 85],
    info: dark ? [0.74, 0.12, 245] : [0.47, 0.13, 250],
    "info-subtle": dark ? [0.27, 0.05, 250] : [0.96, 0.02, 250],
    "chart-1": primary,
    "chart-2": dark ? [0.72, 0.13, 175] : [0.52, 0.1, 180],
    "chart-3": dark ? [0.8, 0.15, 80] : [0.62, 0.14, 70],
    "chart-4": dark ? [0.72, 0.15, 320] : [0.52, 0.17, 320],
    "chart-5": dark ? [0.7, 0.03, h] : [0.55, 0.03, h],
    sidebar: dark ? g(0.17) : g(0.985),
    "sidebar-foreground": text,
    "sidebar-primary": primary,
    "sidebar-primary-foreground": primaryText,
    "sidebar-accent": dark ? g(0.25) : g(0.945),
    "sidebar-accent-foreground": text,
    "sidebar-border": line,
    "sidebar-ring": ring,
  };
}

export function oklchToCss([l, c, h]: Oklch): string {
  const round = (n: number) => Number(n.toFixed(4));
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

/** Relative luminance, used for WCAG contrast checks */
export function luminance([l, c, h]: Oklch): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const m = l + 0.3963377774 * a + 0.2158037573 * b;
  const s = l - 0.1055613458 * a - 0.0638541728 * b;
  const u = l - 0.0894841775 * a - 1.291485548 * b;
  const [x, y, z] = [m ** 3, s ** 3, u ** 3];
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const r = clamp(4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z);
  const g = clamp(-1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z);
  const bl = clamp(-0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

export function contrast(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
