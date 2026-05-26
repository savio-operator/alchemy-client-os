"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Settings, ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { useSidebar } from "@/store/sidebar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Client } from "@/db/schema";

interface SidebarProps {
  clients: Client[];
  onNewClient: () => void;
}

export function Sidebar({ clients, onNewClient }: SidebarProps) {
  const { expanded, toggle } = useSidebar();
  const pathname = usePathname();

  const activeClients = clients.filter((c) => !c.archivedAt);

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full border-r border-[var(--rule)] bg-[var(--bg)] flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 h-14">
        {expanded ? (
          <Link href="/">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-semibold tracking-tight truncate hover:text-[var(--accent-clay)] transition-colors duration-120 cursor-pointer"
            >
              Adchemy
            </motion.span>
          </Link>
        ) : (
          <Tooltip>
            <TooltipTrigger
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
              onClick={() => window.location.href = "/"}
            >
              <Briefcase className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>
        )}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <ChevronLeft className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* New client button */}
      <div className="px-3 mb-2">
        {!expanded ? (
          <Tooltip>
            <TooltipTrigger
              onClick={onNewClient}
              className="w-full flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm font-medium text-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/8 transition-colors duration-120"
            >
              <Plus className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="right">New client</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onNewClient}
            className="w-full flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm font-medium text-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/8 transition-colors duration-120"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>New client</span>
          </button>
        )}
      </div>

      {/* Client list */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {activeClients.map((client) => {
          const href = `/clients/${client.slug}`;
          const isActive = pathname.startsWith(href);

          if (!expanded) {
            return (
              <Tooltip key={client.id}>
                <TooltipTrigger
                  className={`w-full flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm transition-colors duration-120 ${
                    isActive
                      ? "bg-[var(--muted)] font-medium"
                      : "hover:bg-[var(--muted)] text-[var(--ink-muted)]"
                  }`}
                  onClick={() => window.location.href = href}
                >
                  <Briefcase className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                </TooltipTrigger>
                <TooltipContent side="right">{client.name}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={client.id}
              href={href}
              className={`flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm transition-colors duration-120 ${
                isActive
                  ? "bg-[var(--muted)] font-medium"
                  : "hover:bg-[var(--muted)] text-[var(--ink-muted)]"
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{client.name}</span>
            </Link>
          );
        })}

        {activeClients.length === 0 && expanded && (
          <p className="text-xs text-[var(--ink-muted)] px-2 py-4">
            No clients yet. Create your first project.
          </p>
        )}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-[var(--rule)]">
        {!expanded ? (
          <Tooltip>
            <TooltipTrigger
              className="w-full flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors duration-120"
              onClick={() => window.location.href = "/settings"}
            >
              <Settings className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            className="flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors duration-120"
          >
            <Settings className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>Settings</span>
          </Link>
        )}
      </div>
    </motion.aside>
  );
}
