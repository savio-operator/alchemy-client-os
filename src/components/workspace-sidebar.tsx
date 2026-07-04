"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Plus,
  Hash,
  ChevronDown,
  Home,
  CheckSquare,
  Newspaper,
  CheckCircle,
  MessageSquare,
  Users,
  Wallet,
  Receipt,
  Compass,
  Settings,
  SquarePen,
} from "lucide-react";
import type { Client } from "@/db/schema";
import { getActiveSection, type RailSection } from "@/components/workspace-rail";

export const NEWS_CATEGORIES = [
  { key: "all", label: "all-news" },
  { key: "branding", label: "branding" },
  { key: "marketing", label: "marketing" },
  { key: "advertising", label: "advertising" },
  { key: "adtech", label: "adtech" },
  { key: "social", label: "social-media" },
] as const;

const SECTION_TITLES: Record<RailSection, string> = {
  home: "Home",
  clients: "Clients",
  chat: "Chat",
  tasks: "Tasks",
  news: "Industry News",
  finance: "Finance",
  team: "Team",
  settings: "Settings",
};

interface WorkspaceSidebarProps {
  clients: Client[];
  isFounder: boolean;
  chatBadge?: number;
  onNewClient: () => void;
  onNavigate?: () => void;
}

export function WorkspaceSidebar({
  clients,
  isFounder,
  chatBadge,
  onNewClient,
  onNavigate,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = getActiveSection(pathname);
  const activeClients = clients.filter((c) => !c.archivedAt);

  return (
    <div className="w-[256px] shrink-0 flex flex-col bg-[var(--frame-glass-strong)] backdrop-blur-2xl backdrop-saturate-[2] min-h-0">
      {/* Workspace header */}
      <div className="h-[50px] shrink-0 px-4 flex items-center justify-between border-b border-[var(--frame-border)]">
        <button className="flex items-center gap-1 text-white font-bold text-[17px] tracking-tight hover:bg-[var(--frame-hover)] rounded-md px-1.5 py-0.5 -ml-1.5 transition-colors">
          {SECTION_TITLES[section]}
          <ChevronDown className="w-3.5 h-3.5 opacity-70" strokeWidth={2.5} />
        </button>
        {isFounder && section === "clients" && (
          <button
            onClick={onNewClient}
            className="w-8 h-8 rounded-full bg-white text-[var(--frame)] flex items-center justify-center hover:scale-105 transition-transform shadow"
            aria-label="New client"
            title="New client"
          >
            <SquarePen className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Section content */}
      <nav className="flex-1 overflow-y-auto frame-scroll py-3 px-2 space-y-4">
        {(section === "home" || section === "tasks" || section === "settings") && (
          <>
            <SidebarGroup label="Workspace">
              <SidebarItem href="/" icon={Home} label="Home" active={pathname === "/"} onNavigate={onNavigate} />
              <SidebarItem href="/tasks" icon={CheckSquare} label="Tasks" active={pathname.startsWith("/tasks")} onNavigate={onNavigate} />
              <SidebarItem href="/news" icon={Newspaper} label="Industry News" active={false} onNavigate={onNavigate} />
              <SidebarItem href="/attendance" icon={CheckCircle} label="Completion" active={pathname === "/attendance"} onNavigate={onNavigate} />
              <SidebarItem href="/chat" icon={MessageSquare} label="Chat" active={false} badge={chatBadge} onNavigate={onNavigate} />
              <SidebarItem href="/settings" icon={Settings} label="Settings" active={pathname.startsWith("/settings")} onNavigate={onNavigate} />
            </SidebarGroup>
            <ClientChannels
              clients={activeClients}
              pathname={pathname}
              isFounder={isFounder}
              onNewClient={onNewClient}
              onNavigate={onNavigate}
            />
          </>
        )}

        {section === "clients" && (
          <>
            <ClientChannels
              clients={activeClients}
              pathname={pathname}
              isFounder={isFounder}
              onNewClient={onNewClient}
              onNavigate={onNavigate}
              expandActive
            />
          </>
        )}

        {section === "chat" && (
          <SidebarGroup label="Conversations">
            <SidebarItem href="/chat" icon={MessageSquare} label="Team Chat" active={pathname === "/chat"} badge={chatBadge} onNavigate={onNavigate} />
          </SidebarGroup>
        )}

        {section === "news" && (
          <SidebarGroup label="Channels">
            {NEWS_CATEGORIES.map((cat) => {
              const current = searchParams.get("category") || "all";
              return (
                <SidebarItem
                  key={cat.key}
                  href={cat.key === "all" ? "/news" : `/news?category=${cat.key}`}
                  icon={Hash}
                  label={cat.label}
                  active={pathname.startsWith("/news") && current === cat.key}
                  onNavigate={onNavigate}
                />
              );
            })}
          </SidebarGroup>
        )}

        {section === "finance" && isFounder && (
          <>
            <SidebarGroup label="Finance">
              <SidebarItem href="/finance" icon={Wallet} label="Dashboard" active={pathname === "/finance"} onNavigate={onNavigate} />
              <SidebarItem href="/finance/entries" icon={Hash} label="Entries" active={pathname.startsWith("/finance/entries")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/invoices" icon={Hash} label="Invoices" active={pathname.startsWith("/finance/invoices")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/yearly" icon={Hash} label="Yearly" active={pathname.startsWith("/finance/yearly")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/advisor" icon={Hash} label="Advisor" active={pathname.startsWith("/finance/advisor")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/parse" icon={Hash} label="Parse" active={pathname.startsWith("/finance/parse")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/reports" icon={Hash} label="Reports" active={pathname.startsWith("/finance/reports")} onNavigate={onNavigate} />
              <SidebarItem href="/finance/setup" icon={Hash} label="Setup" active={pathname.startsWith("/finance/setup")} onNavigate={onNavigate} />
            </SidebarGroup>
            <SidebarGroup label="Sales">
              <SidebarItem href="/invoices" icon={Receipt} label="Client Invoices" active={pathname.startsWith("/invoices")} onNavigate={onNavigate} />
              <SidebarItem href="/leads" icon={Compass} label="Leads" active={pathname.startsWith("/leads")} onNavigate={onNavigate} />
            </SidebarGroup>
          </>
        )}

        {section === "team" && isFounder && (
          <SidebarGroup label="People">
            <SidebarItem href="/team" icon={Users} label="Members" active={pathname === "/team"} onNavigate={onNavigate} />
            <SidebarItem href="/attendance" icon={CheckCircle} label="Completion" active={pathname === "/attendance"} onNavigate={onNavigate} />
          </SidebarGroup>
        )}
      </nav>
    </div>
  );
}

const CLIENT_SUBPAGES = [
  { path: "", label: "Overview" },
  { path: "/feed", label: "Feed" },
  { path: "/ideas", label: "Ideas" },
  { path: "/marketing", label: "Marketing" },
  { path: "/social", label: "Social" },
  { path: "/history", label: "History" },
  { path: "/agents", label: "Agents" },
  { path: "/profile", label: "Profile" },
];

function ClientChannels({
  clients,
  pathname,
  isFounder,
  onNewClient,
  onNavigate,
  expandActive,
}: {
  clients: Client[];
  pathname: string;
  isFounder: boolean;
  onNewClient: () => void;
  onNavigate?: () => void;
  expandActive?: boolean;
}) {
  return (
    <SidebarGroup label="Clients">
      {clients.map((client) => {
        const href = `/clients/${client.slug}`;
        const isActive = pathname.startsWith(href);
        return (
          <div key={client.id}>
            <SidebarItem
              href={href}
              icon={Hash}
              label={client.slug}
              active={isActive && (!expandActive || pathname === href)}
              onNavigate={onNavigate}
            />
            {expandActive && isActive && (
              <div className="ml-4 border-l border-[var(--frame-border)] pl-2 my-0.5 space-y-px">
                {CLIENT_SUBPAGES.map((sub) => {
                  const subHref = `${href}${sub.path}`;
                  const subActive = pathname === subHref;
                  return (
                    <Link
                      key={sub.path}
                      href={subHref}
                      onClick={onNavigate}
                      className={`block px-2 py-1 rounded-md text-[13px] transition-colors ${
                        subActive
                          ? "bg-[var(--frame-active)] text-white font-medium"
                          : "text-[var(--frame-text-dim)] hover:bg-[var(--frame-hover)] hover:text-white"
                      }`}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {clients.length === 0 && (
        <p className="text-[13px] text-[var(--frame-text-dim)] px-2 py-1">
          No clients yet
        </p>
      )}
      {isFounder && (
        <button
          onClick={onNewClient}
          className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[15px] text-[var(--frame-text-dim)] hover:bg-[var(--frame-hover)] hover:text-white transition-colors"
        >
          <span className="w-[18px] h-[18px] rounded flex items-center justify-center bg-[var(--frame-hover)]">
            <Plus className="w-3 h-3" strokeWidth={2.5} />
          </span>
          Add client
        </button>
      )}
    </SidebarGroup>
  );
}

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 px-2 mb-1 text-[13px] font-medium text-[var(--frame-text-dim)]">
        <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
        {label}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function SidebarItem({
  href,
  icon: Icon,
  label,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const hasBadge = badge != null && badge > 0;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 px-2 py-1 rounded-md text-[15px] transition-colors ${
        active
          ? "bg-[var(--frame-active)] text-white font-medium"
          : hasBadge
          ? "text-white font-bold hover:bg-[var(--frame-hover)]"
          : "text-[var(--frame-text-dim)] hover:bg-[var(--frame-hover)] hover:text-white"
      }`}
    >
      <Icon className="w-[15px] h-[15px] shrink-0 opacity-80" strokeWidth={1.8} />
      <span className="flex-1 truncate">{label}</span>
      {hasBadge && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#e01e5a] text-white text-[10px] font-bold flex items-center justify-center">
          {badge! > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
