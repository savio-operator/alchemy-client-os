"use client";

import { useState, useEffect, Suspense, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceRail } from "@/components/workspace-rail";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { TopBar } from "@/components/top-bar";
import { AgentDrawer } from "@/components/agent-drawer";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { useUser } from "@/store/user";
import { useSidebar } from "@/store/sidebar";
import type { Client } from "@/db/schema";

export function AppShell({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useUser();
  const { mobileOpen, setMobileOpen } = useSidebar();

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Fetch current user
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.replace("/login");
        }
      });
  }, [setUser, router]);

  const fetchClients = () => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  };

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const breadcrumbs = buildBreadcrumbs(pathname, clients);
  const isFounder = user?.role === "founder";

  const sidebar = (
    <Suspense fallback={<div className="w-[256px] shrink-0 bg-[var(--frame-glass-strong)]" />}>
      <WorkspaceSidebar
        clients={clients}
        isFounder={isFounder}
        onNewClient={() => {
          setShowOnboarding(true);
          setMobileOpen(false);
        }}
        onNavigate={() => setMobileOpen(false)}
      />
    </Suspense>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--frame-dark)]">
      <TopBar breadcrumbs={breadcrumbs} userName={user?.name} />

      <div className="flex flex-1 min-h-0">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Rail + contextual sidebar — overlay drawer on mobile */}
        <div
          className={`
            fixed inset-y-0 left-0 z-50 flex md:relative md:z-auto md:inset-auto
            bg-[var(--frame-glass)] backdrop-blur-2xl backdrop-saturate-[2]
            transform transition-transform duration-200 ease-in-out
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0
          `}
        >
          <WorkspaceRail
            isFounder={isFounder}
            clients={clients}
            userName={user?.name}
          />
          {sidebar}
        </div>

        {/* Content panel — the light rounded surface inside the frame */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg)] md:rounded-tl-xl border-t border-l border-[var(--rule)]/40">
          <div className="animate-panel-in">{children}</div>
        </main>
      </div>

      <AgentDrawer />

      <CommandPalette
        clients={clients}
        onNewClient={() => setShowOnboarding(true)}
      />

      {showOnboarding && user?.role === "founder" && (
        <OnboardingWizard
          onClose={() => setShowOnboarding(false)}
          onCreated={(slug) => {
            setShowOnboarding(false);
            fetchClients();
            router.push(`/clients/${slug}`);
          }}
        />
      )}
    </div>
  );
}

function buildBreadcrumbs(
  pathname: string,
  clients: Client[]
): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Home" }];
  }

  if (segments[0] === "clients" && segments[1]) {
    const client = clients.find((c) => c.slug === segments[1]);
    const crumbs: { label: string; href?: string }[] = [
      { label: client?.name || segments[1], href: `/clients/${segments[1]}` },
    ];

    if (segments[2]) {
      crumbs.push({
        label: segments[2].charAt(0).toUpperCase() + segments[2].slice(1),
      });
    }

    return crumbs;
  }

  if (segments[0] === "settings") {
    return [{ label: "Settings" }];
  }

  if (segments[0] === "attendance") {
    return [{ label: "Completion" }];
  }

  if (segments[0] === "chat") {
    return [{ label: "Team Chat" }];
  }

  if (segments[0] === "invoices") {
    return [{ label: "Invoices" }];
  }

  if (segments[0] === "leads") {
    return [{ label: "Leads" }];
  }

  if (segments[0] === "tasks") {
    return [{ label: "Tasks" }];
  }

  if (segments[0] === "news") {
    return [{ label: "Industry News" }];
  }

  if (segments[0] === "finance") {
    return [{ label: "Finance" }];
  }

  if (segments[0] === "team") {
    return [{ label: "Team" }];
  }

  return [{ label: "Home" }];
}
