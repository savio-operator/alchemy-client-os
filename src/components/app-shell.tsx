"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, shown as overlay when mobileOpen */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 md:relative md:z-auto
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <Sidebar
          clients={clients}
          userRole={user?.role || "member"}
          onNewClient={() => { setShowOnboarding(true); setMobileOpen(false); }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar breadcrumbs={breadcrumbs} userName={user?.name} />

        <main className="flex-1 overflow-y-auto">
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

  if (segments[0] === "team") {
    return [{ label: "Team" }];
  }

  return [{ label: "Home" }];
}
