"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

interface SectionStubProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
}

export function SectionStub({ icon: Icon, title, description, action }: SectionStubProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-semibold font-serif">{title}</h1>
        <Badge variant="secondary" className="text-xs">Coming in Phase 2</Badge>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center"
      >
        <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
          <Icon className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium mb-1">{description}</p>
        <p className="text-xs text-[var(--ink-muted)]">{action}</p>
      </motion.div>
    </div>
  );
}
