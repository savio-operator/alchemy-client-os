"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Briefcase,
  MessageSquare,
  CheckSquare,
  Newspaper,
  Wallet,
  Users,
  Settings,
} from "lucide-react";
import type { Client } from "@/db/schema";

export type RailSection =
  | "home"
  | "clients"
  | "chat"
  | "tasks"
  | "news"
  | "finance"
  | "team"
  | "settings";

export function getActiveSection(pathname: string): RailSection {
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/news")) return "news";
  if (
    pathname.startsWith("/finance") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/leads")
  )
    return "finance";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

interface RailItem {
  section: RailSection;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  href: string;
  founderOnly?: boolean;
}

const RAIL_ITEMS: RailItem[] = [
  { section: "home", label: "Home", icon: Home, href: "/" },
  { section: "clients", label: "Clients", icon: Briefcase, href: "/" },
  { section: "chat", label: "Chat", icon: MessageSquare, href: "/chat" },
  { section: "tasks", label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { section: "news", label: "News", icon: Newspaper, href: "/news" },
  { section: "finance", label: "Finance", icon: Wallet, href: "/finance", founderOnly: true },
  { section: "team", label: "Team", icon: Users, href: "/team", founderOnly: true },
];

interface WorkspaceRailProps {
  isFounder: boolean;
  clients: Client[];
  chatBadge?: number;
  userName?: string;
}

export function WorkspaceRail({
  isFounder,
  clients,
  chatBadge,
  userName,
}: WorkspaceRailProps) {
  const pathname = usePathname();
  const active = getActiveSection(pathname);

  const items = RAIL_ITEMS.filter((i) => isFounder || !i.founderOnly).map(
    (i) => {
      // "Clients" jumps to the first client if one exists
      if (i.section === "clients" && clients.length > 0) {
        const first = clients.find((c) => !c.archivedAt) || clients[0];
        return { ...i, href: `/clients/${first.slug}` };
      }
      return i;
    }
  );

  return (
    <div className="w-[68px] shrink-0 flex flex-col items-center bg-[var(--frame-glass)] backdrop-blur-2xl backdrop-saturate-[2] pt-2 pb-3">
      {/* Workspace mark */}
      <Link
        href="/"
        className="w-9 h-9 mb-3 rounded-[10px] bg-white/95 flex items-center justify-center font-bold text-lg text-[var(--frame)] hover:scale-105 transition-transform"
        aria-label="Adchemy home"
      >
        A
      </Link>

      {/* Section icons */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full overflow-y-auto frame-scroll">
        {items.map((item) => {
          const isActive = active === item.section;
          return (
            <Link
              key={item.section}
              href={item.href}
              className="group flex flex-col items-center gap-0.5 w-full py-1"
            >
              <span
                className={`relative w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-[var(--frame-active)] text-white"
                    : "text-[var(--frame-text-dim)] group-hover:bg-[var(--frame-hover)] group-hover:text-white"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {item.section === "chat" && (chatBadge ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-[#e01e5a] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[var(--frame-dark)]">
                    {chatBadge! > 9 ? "9+" : chatBadge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-white" : "text-[var(--frame-text-dim)]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: settings + avatar */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <Link
          href="/settings"
          className={`w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors ${
            active === "settings"
              ? "bg-[var(--frame-active)] text-white"
              : "text-[var(--frame-text-dim)] hover:bg-[var(--frame-hover)] hover:text-white"
          }`}
          aria-label="Settings"
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </Link>
        <div className="relative">
          <div className="w-9 h-9 rounded-[8px] bg-[var(--frame-hover)] flex items-center justify-center text-xs font-bold text-white">
            {userName
              ? userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?"}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--presence)] border-2 border-[var(--frame-dark)]" />
        </div>
      </div>
    </div>
  );
}
