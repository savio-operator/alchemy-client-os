"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Command, PanelRight, LogOut, User } from "lucide-react";
import { useCommandPalette } from "@/store/command-palette";
import { useDrawer } from "@/store/drawer";
import { useUser } from "@/store/user";

interface TopBarProps {
  breadcrumbs: { label: string; href?: string }[];
  userName?: string;
}

export function TopBar({ breadcrumbs, userName }: TopBarProps) {
  const { setOpen: openPalette } = useCommandPalette();
  const { toggle: toggleDrawer } = useDrawer();
  const { clearUser } = useUser();
  const [notifCount, setNotifCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifCount(data.count || 0))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data) => setNotifCount(data.count || 0))
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUser();
    router.replace("/login");
  };

  return (
    <header className="h-14 border-b border-[var(--rule)] flex items-center justify-between px-4 shrink-0 bg-[var(--bg)]">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-[var(--ink-muted)]">/</span>}
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
          <Bell
            className="w-4 h-4 text-[var(--ink-muted)]"
            strokeWidth={1.5}
          />
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
          aria-label="AI Chat"
        >
          <PanelRight
            className="w-4 h-4 text-[var(--ink-muted)]"
            strokeWidth={1.5}
          />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--accent-clay)]/10 hover:bg-[var(--accent-clay)]/20 transition-colors duration-120"
            aria-label="User menu"
          >
            <span className="text-xs font-medium text-[var(--accent-clay)]">
              {userName
                ? userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "?"}
            </span>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius)] shadow-lg z-50">
              <div className="px-3 py-2 border-b border-[var(--rule)]">
                <p className="text-sm font-medium truncate">{userName}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
