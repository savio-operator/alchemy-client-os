"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Users,
  CheckCircle,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { useSidebar } from "@/store/sidebar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { Client } from "@/db/schema";

interface SidebarProps {
  clients: Client[];
  userRole: "founder" | "manager" | "member";
  onNewClient: () => void;
}

export function Sidebar({ clients, userRole, onNewClient }: SidebarProps) {
  const { expanded, toggle, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const [updateCounts, setUpdateCounts] = useState<Record<string, number>>({});

  const activeClients = clients.filter((c) => !c.archivedAt);
  const isFounder = userRole === "founder";

  // Poll for update badges
  useEffect(() => {
    const poll = () => {
      fetch("/api/updates")
        .then((r) => r.json())
        .then((data) => setUpdateCounts(data))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 60_000);
    return () => clearInterval(interval);
  }, []);

  // On mobile, sidebar is always expanded (w-64) when shown via the overlay
  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full border-r border-[var(--rule)] bg-[var(--bg)] flex flex-col shrink-0 overflow-hidden w-64 md:w-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 h-14">
        {expanded ? (
          <Link
            href="/"
            className="flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-sm)] bg-[var(--accent-clay)]/10 hover:bg-[var(--accent-clay)]/18 transition-colors duration-120"
          >
            <Briefcase className="w-3.5 h-3.5 text-[var(--accent-clay)]" strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight text-[var(--accent-clay)]">
              Adchemy
            </span>
          </Link>
        ) : (
          <Tooltip>
            <TooltipTrigger
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-clay)]/10 hover:bg-[var(--accent-clay)]/18 transition-colors duration-120"
              onClick={() => (window.location.href = "/")}
            >
              <Briefcase
                className="w-4 h-4 text-[var(--accent-clay)]"
                strokeWidth={1.5}
              />
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>
        )}
        <button
          onClick={toggle}
          className="hidden md:flex w-8 h-8 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <ChevronLeft
              className="w-4 h-4 text-[var(--ink-muted)]"
              strokeWidth={1.5}
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 text-[var(--ink-muted)]"
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>

      {/* New client button — founders only */}
      {isFounder && (
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
      )}

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
                  onClick={() => (window.location.href = href)}
                >
                  <Briefcase
                    className="w-4 h-4 shrink-0"
                    strokeWidth={1.5}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">{client.name}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={client.id}
              href={href}
              onClick={() => setMobileOpen(false)}
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
            No clients yet.
          </p>
        )}
      </nav>

      {/* Bottom nav */}
      <div className="p-3 border-t border-[var(--rule)] space-y-0.5">
        {/* Finance — founders only */}
        {isFounder && (
          <SidebarLink
            href="/finance"
            icon={Wallet}
            label="Finance"
            expanded={expanded}
            active={pathname.startsWith("/finance")}
            onNavigate={() => setMobileOpen(false)}
          />
        )}

        {/* Team Chat */}
        <SidebarLink
          href="/chat"
          icon={MessageSquare}
          label="Chat"
          expanded={expanded}
          active={pathname === "/chat"}
          badge={updateCounts.chat}
          onNavigate={() => setMobileOpen(false)}
        />

        {/* Completion — all roles */}
        <SidebarLink
          href="/attendance"
          icon={CheckCircle}
          label="Completion"
          expanded={expanded}
          active={pathname === "/attendance"}
          onNavigate={() => setMobileOpen(false)}
        />

        {/* Team — founders only */}
        {isFounder && (
          <SidebarLink
            href="/team"
            icon={Users}
            label="Team"
            expanded={expanded}
            active={pathname === "/team"}
            onNavigate={() => setMobileOpen(false)}
          />
        )}

        {/* Settings */}
        <SidebarLink
          href="/settings"
          icon={Settings}
          label="Settings"
          expanded={expanded}
          active={pathname === "/settings"}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
    </motion.aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  expanded,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  expanded: boolean;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger
          className={`relative w-full flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm transition-colors duration-120 ${
            active
              ? "bg-[var(--muted)] font-medium"
              : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
          }`}
          onClick={() => (window.location.href = href)}
        >
          <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          {badge != null && badge > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--accent-clay)]" />
          )}
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 h-9 px-2 rounded-[var(--radius-sm)] text-sm transition-colors duration-120 ${
        active
          ? "bg-[var(--muted)] font-medium"
          : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="w-5 h-5 bg-[var(--accent-clay)] text-white text-[10px] font-medium rounded-full flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
