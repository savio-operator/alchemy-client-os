"use client";

const STORAGE_KEY = "adchemy-glass-opacity";

/** Reads the persisted glass-transparency preference as a 30-100 percent. */
export function getGlassOpacity(): number {
  if (typeof window === "undefined") return 100;
  const saved = parseFloat(localStorage.getItem(STORAGE_KEY) || "1");
  return Math.round((Number.isFinite(saved) ? saved : 1) * 100);
}

/** Applies + persists a 30-100 percent glass-transparency preference. */
export function setGlassOpacity(percent: number) {
  const value = (percent / 100).toString();
  document.documentElement.style.setProperty("--glass-opacity", value);
  localStorage.setItem(STORAGE_KEY, value);
}
