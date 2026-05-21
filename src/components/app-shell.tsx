"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { AgentDrawer } from "@/components/agent-drawer";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import type { Client } from "@/db/schema";

export function AppShell({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const fetchClients = () => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const breadcrumbs = buildBreadcrumbs(pathname, clients);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        clients={clients}
        onNewClient={() => setShowOnboarding(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar breadcrumbs={breadcrumbs} />

        <main className="flex-1 overflow-y-auto">
          <div className="animate-panel-in">{children}</div>
        </main>
      </div>

      <AgentDrawer />

      <CommandPalette
        clients={clients}
        onNewClient={() => setShowOnboarding(true)}
      />

      {showOnboarding && (
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

  return [{ label: "Home" }];
}
