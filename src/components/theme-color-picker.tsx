"use client";

import { useEffect, useState } from "react";
import { Check, Paintbrush, RotateCcw } from "lucide-react";
import {
  DEFAULT_FRAME,
  THEME_PRESETS,
  getSavedFrameColor,
  setFrameColor,
  hexToHsl,
} from "@/lib/theme";

export function ThemeColorPicker() {
  const [current, setCurrent] = useState(DEFAULT_FRAME);
  const [hexInput, setHexInput] = useState("");
  const [hexError, setHexError] = useState(false);

  useEffect(() => {
    const saved = getSavedFrameColor();
    setCurrent(saved);
    setHexInput(saved);
  }, []);

  const apply = (hex: string) => {
    if (setFrameColor(hex)) {
      setCurrent(hex.toUpperCase());
      setHexInput(hex.toUpperCase());
      setHexError(false);
    } else {
      setHexError(true);
    }
  };

  const handleHexSubmit = () => {
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (hexToHsl(normalized)) {
      apply(normalized);
    } else {
      setHexError(true);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-0.5">Workspace color</p>
        <p className="text-xs text-[var(--ink-muted)]">
          Colors the sidebar, rail and top bar — Slack style. Pick a preset,
          use the color wheel, or enter a hex code.
        </p>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {THEME_PRESETS.map((preset) => {
          const isActive = current.toUpperCase() === preset.hex.toUpperCase();
          return (
            <button
              key={preset.hex}
              onClick={() => apply(preset.hex)}
              title={preset.name}
              className={`relative w-9 h-9 rounded-[8px] transition-transform hover:scale-110 ${
                isActive ? "ring-2 ring-offset-2 ring-[var(--theme-accent)]" : ""
              }`}
              style={{ backgroundColor: preset.hex }}
              aria-label={`${preset.name} theme`}
            >
              {isActive && (
                <Check
                  className="w-4 h-4 text-white absolute inset-0 m-auto"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}

        {/* Color wheel */}
        <label
          className="relative w-9 h-9 rounded-[8px] cursor-pointer border border-[var(--rule)] flex items-center justify-center hover:scale-110 transition-transform"
          style={{
            background:
              "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
          }}
          title="Custom color"
        >
          <Paintbrush className="w-4 h-4 text-white drop-shadow" strokeWidth={2} />
          <input
            type="color"
            value={current}
            onChange={(e) => apply(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick custom workspace color"
          />
        </label>
      </div>

      {/* Hex input + reset */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            setHexError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleHexSubmit()}
          onBlur={handleHexSubmit}
          placeholder="#3F0E40"
          maxLength={7}
          className={`w-28 h-8 px-2.5 rounded-md border text-sm font-mono bg-[var(--bg)] ${
            hexError ? "border-[var(--destructive)]" : "border-[var(--rule)]"
          }`}
          aria-label="Hex color code"
        />
        <span
          className="w-8 h-8 rounded-md border border-[var(--rule)]"
          style={{ backgroundColor: current }}
        />
        {current.toUpperCase() !== DEFAULT_FRAME && (
          <button
            onClick={() => apply(DEFAULT_FRAME)}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={2} />
            Reset to Aubergine
          </button>
        )}
      </div>
      {hexError && (
        <p className="text-xs text-[var(--destructive)]">
          Enter a valid 6-digit hex code, e.g. #1A1D29
        </p>
      )}
    </div>
  );
}
