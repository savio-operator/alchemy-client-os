"use client";

import { useEffect, useState } from "react";
import { Bell, Command, PanelRight } from "lucide-react";
import { useCommandPalette } from "@/store/command-palette";
import { useDrawer } from "@/store/drawer";

interface TopBarProps {
  breadcrumbs: { label: string; href?: string }[];
}

export function TopBar({ breadcrumbs }: TopBarProps) {
  const { setOpen: openPalette } = useCommandPalette();
  const { toggle: toggleDrawer } = useDrawer();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifCount(data.count || 0))
      .catch(() => {});

    // Poll every 5 minutes
    const interval = setInterval(() => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data) => setNotifCount(data.count || 0))
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 border-b border-[var(--rule)] flex items-center justify-between px-4 shrink-0 bg-[var(--bg)]">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <span className="text-[var(--ink-muted)]">/</span>
            )}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors duration-120 truncate"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="font-medium truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <button
          onClick={() => openPalette(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors duration-120"
        >
          <span className="hidden sm:inline">Ask</span>
          <kbd className="text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
            <Command className="w-3 h-3" strokeWidth={1.5} />K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--accent-clay)] text-white text-[9px] font-medium rounded-full flex items-center justify-center">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>

        {/* Agent drawer toggle */}
        <button
          onClick={toggleDrawer}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
          aria-label="Agent runner"
        >
          <PanelRight className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
