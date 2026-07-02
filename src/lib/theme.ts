/*
 * Frame theme engine.
 * The user picks a single base hex for the workspace frame (rail + sidebar +
 * top bar); everything else — darker rail, hover/active overlays, readable
 * text, and the content-area accent — is derived here so any color works.
 */

export const DEFAULT_FRAME = "#3F0E40"; // Slack aubergine

export const THEME_STORAGE_KEY = "adchemy-frame";
// v2: palettes now carry tint hue/saturation for content-area tinting
// instead of a fixed --theme-accent. Old cached v1 JSON is simply ignored.
export const THEME_VARS_KEY = "adchemy-frame-vars-v2";

export const THEME_PRESETS: { name: string; hex: string }[] = [
  { name: "Aubergine", hex: "#3F0E40" },
  { name: "Midnight", hex: "#1A1D29" },
  { name: "Ochin", hex: "#303E4D" },
  { name: "Work Hard", hex: "#4D394B" },
  { name: "Forest", hex: "#1E3A2F" },
  { name: "Crimson", hex: "#5C1A2E" },
  { name: "Ocean", hex: "#0B4F6C" },
  { name: "Clay", hex: "#8A3B24" },
];

interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): HSL | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslCss({ h, s, l }: HSL): string {
  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface FramePalette {
  "--frame": string;
  "--frame-dark": string;
  "--frame-darker": string;
  "--frame-text": string;
  "--frame-text-dim": string;
  "--frame-hover": string;
  "--frame-active": string;
  "--frame-border": string;
  /* Tint hue/saturation — globals.css derives all content-area tokens
     (bg, cards, borders, text, accent) from these, per light/dark mode. */
  "--tint-h": string;
  "--tint-s": string;
}

/** Derive the full frame palette from a single base hex. */
export function deriveFramePalette(hex: string): FramePalette | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;

  // Keep the frame dark enough that white text is readable.
  const frame: HSL = { ...hsl, l: clamp(hsl.l, 8, 42) };
  const isLightPick = hsl.l > 42;

  const frameDark: HSL = { ...frame, l: clamp(frame.l - 4, 5, 100) };
  const frameDarker: HSL = { ...frame, l: clamp(frame.l - 8, 3, 100) };

  return {
    "--frame": hslCss(frame),
    "--frame-dark": hslCss(frameDark),
    "--frame-darker": hslCss(frameDarker),
    "--frame-text": "rgba(255, 255, 255, 0.88)",
    "--frame-text-dim": "rgba(255, 255, 255, 0.62)",
    "--frame-hover": "rgba(255, 255, 255, 0.10)",
    "--frame-active": isLightPick
      ? "rgba(255, 255, 255, 0.30)"
      : "rgba(255, 255, 255, 0.22)",
    "--frame-border": "rgba(255, 255, 255, 0.13)",
    // Grayscale picks (s≈0) keep a whisper of saturation so calc() math
    // still produces neutral-looking surfaces rather than pure gray-on-gray.
    "--tint-h": String(Math.round(hsl.h)),
    "--tint-s": String(Math.round(clamp(hsl.s, 4, 100))),
  };
}

export function applyFramePalette(palette: FramePalette): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }
}

export function clearFramePalette(): void {
  const root = document.documentElement;
  const keys: (keyof FramePalette)[] = [
    "--frame",
    "--frame-dark",
    "--frame-darker",
    "--frame-text",
    "--frame-text-dim",
    "--frame-hover",
    "--frame-active",
    "--frame-border",
    "--tint-h",
    "--tint-s",
  ];
  for (const key of keys) root.style.removeProperty(key);
}

/** Persist + apply a frame color. Pass null to reset to default aubergine. */
export function setFrameColor(hex: string | null): boolean {
  if (!hex || hex.toUpperCase() === DEFAULT_FRAME) {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(THEME_VARS_KEY);
    clearFramePalette();
    return true;
  }

  const palette = deriveFramePalette(hex);
  if (!palette) return false;

  localStorage.setItem(THEME_STORAGE_KEY, hex);
  // Pre-computed vars so the pre-paint inline script can apply them
  // without duplicating the derivation math.
  localStorage.setItem(THEME_VARS_KEY, JSON.stringify(palette));
  applyFramePalette(palette);
  return true;
}

export function getSavedFrameColor(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_FRAME;
  } catch {
    return DEFAULT_FRAME;
  }
}
