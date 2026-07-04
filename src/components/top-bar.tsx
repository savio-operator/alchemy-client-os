"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Command, PanelRight, LogOut, Pencil, Check, X, Menu, Droplet } from "lucide-react";
import { useCommandPalette } from "@/store/command-palette";
import { useDrawer } from "@/store/drawer";
import { useUser } from "@/store/user";
import { useSidebar } from "@/store/sidebar";
import { getGlassOpacity, setGlassOpacity } from "@/lib/glass-opacity";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface TopBarProps {
  breadcrumbs: { label: string; href?: string }[];
  userName?: string;
}

export function TopBar({ breadcrumbs, userName }: TopBarProps) {
  const { setOpen: openPalette } = useCommandPalette();
  const { toggle: toggleDrawer } = useDrawer();
  const { clearUser, setUser } = useUser();
  const { setMobileOpen } = useSidebar();
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGlass, setShowGlass] = useState(false);
  const [glassOpacity, setGlassOpacityState] = useState(100);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(userName || "");
  const [nameSaving, setNameSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifs = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifCount(data.count || 0);
        setNotifications(data.items || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setNameValue(userName || "");
  }, [userName]);

  useEffect(() => {
    setGlassOpacityState(getGlassOpacity());
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setEditingName(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (glassRef.current && !glassRef.current.contains(e.target as Node)) {
        setShowGlass(false);
      }
    };
    if (showMenu || showNotifs || showGlass) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showNotifs, showGlass]);

  const handleGlassOpacity = (percent: number) => {
    setGlassOpacityState(percent);
    setGlassOpacity(percent);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUser();
    router.replace("/login");
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    setNotifCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif.id, action: "read" }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setNotifCount((c) => Math.max(0, c - 1));
    }
    if (notif.link) {
      setShowNotifs(false);
      router.push(notif.link);
    }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === userName) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim(), email: undefined }),
      });
      if (res.ok) {
        const statusRes = await fetch("/api/auth/status");
        const data = await statusRes.json();
        if (data.user) setUser(data.user);
      }
    } catch {
      // silent fail
    } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  };

  return (
    <header className="h-[44px] flex items-center gap-2 px-2 md:px-3 shrink-0 bg-[var(--frame-dark)]">
      {/* Mobile hamburger + Breadcrumbs */}
      <div className="flex items-center gap-1.5 min-w-0 md:w-56 shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--frame-hover)] transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-[var(--frame-text)]" strokeWidth={1.5} />
        </button>
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-[var(--frame-text-dim)]">/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="text-[var(--frame-text-dim)] hover:text-white transition-colors duration-120 truncate"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="font-medium text-[var(--frame-text)] truncate">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Centered search — Slack style */}
      <div className="flex-1 flex justify-center min-w-0 px-2">
        <button
          onClick={() => openPalette(true)}
          className="glass-sheen w-full max-w-[640px] h-7 flex items-center gap-2 px-3.5 rounded-full bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-white/25 text-[13px] text-white/85 transition-colors"
        >
          <span className="truncate">Search Adchemy or ask AI</span>
          <kbd className="ml-auto hidden sm:flex text-[11px] text-white/70 font-mono items-center gap-0.5">
            <Command className="w-3 h-3" strokeWidth={1.5} />K
          </kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 md:w-56 shrink-0 justify-end">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--frame-hover)] transition-colors duration-120"
            aria-label="Notifications"
          >
            <Bell
              className="w-4 h-4 text-[var(--frame-text)]"
              strokeWidth={1.5}
            />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#e01e5a] text-white text-[9px] font-medium rounded-full flex items-center justify-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-10 w-[calc(100vw-2rem)] sm:w-80 max-h-96 material border border-[var(--rule)] rounded-xl shadow-elevated animate-pop-in z-50 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--rule)] flex items-center justify-between">
                <span className="text-sm font-medium">Notifications</span>
                {notifCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-[var(--accent-clay)] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-[var(--ink-muted)]">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 20).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-3 py-2.5 border-b border-[var(--rule)] hover:bg-[var(--muted)] transition-colors ${
                        !notif.isRead ? "bg-[var(--accent-clay)]/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-clay)] mt-1.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          {notif.body && (
                            <p className="text-xs text-[var(--ink-muted)] line-clamp-2">
                              {notif.body}
                            </p>
                          )}
                          <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                            {formatNotifDate(notif.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Glass transparency */}
        <div className="relative" ref={glassRef}>
          <button
            onClick={() => setShowGlass(!showGlass)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--frame-hover)] transition-colors duration-120"
            aria-label="Adjust transparency"
            title="Adjust transparency"
          >
            <Droplet
              className="w-4 h-4 text-[var(--frame-text)]"
              strokeWidth={1.5}
            />
          </button>

          {showGlass && (
            <div className="absolute right-0 top-10 w-64 material border border-[var(--rule)] rounded-xl shadow-elevated animate-pop-in z-50 p-4">
              <p className="text-sm font-medium mb-0.5">Window transparency</p>
              <p className="text-xs text-[var(--ink-muted)] mb-3">
                How much of the glass chrome lets content show through
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={1}
                  value={glassOpacity}
                  onChange={(e) => handleGlassOpacity(Number(e.target.value))}
                  className="flex-1 accent-[var(--theme-accent)]"
                />
                <span className="w-10 text-right text-xs text-[var(--ink-muted)] tabular-nums">
                  {glassOpacity}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Agent drawer toggle */}
        <button
          onClick={toggleDrawer}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--frame-hover)] transition-colors duration-120"
          aria-label="AI Chat"
        >
          <PanelRight
            className="w-4 h-4 text-[var(--frame-text)]"
            strokeWidth={1.5}
          />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-[var(--frame-hover)] hover:bg-[var(--frame-active)] transition-colors duration-120"
            aria-label="User menu"
          >
            <span className="text-xs font-bold text-white">
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
            <div className="absolute right-0 top-10 w-56 material border border-[var(--rule)] rounded-xl shadow-elevated animate-pop-in z-50 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-[var(--rule)]">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      className="text-sm font-medium flex-1 bg-transparent border-b border-[var(--accent-clay)] outline-none"
                      autoFocus
                      disabled={nameSaving}
                    />
                    <button
                      onClick={handleSaveName}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--muted)]"
                    >
                      <Check className="w-3 h-3 text-green-600" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameValue(userName || ""); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--muted)]"
                    >
                      <X className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <button
                      onClick={() => setEditingName(true)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit name"
                    >
                      <Pencil className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setShowMenu(false); router.push("/settings"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                Edit profile
              </button>
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

function formatNotifDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
