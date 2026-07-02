"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setFrameColor, THEME_STORAGE_KEY } from "@/lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Re-derive the saved theme on mount: migrates palettes cached under old
  // storage versions and keeps the applied vars in sync with the engine.
  useEffect(() => {
    try {
      localStorage.removeItem("adchemy-frame-vars"); // stale v1 cache
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) setFrameColor(saved);
    } catch {
      // localStorage unavailable — default theme applies
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={300}>
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
