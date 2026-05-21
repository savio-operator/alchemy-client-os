"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";
import type { Client } from "@/db/schema";

export default function HomePage() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  const activeClients = clients.filter((c) => !c.archivedAt);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold mb-2">Welcome back</h1>
      <p className="text-[var(--ink-muted)] mb-8">
        Your client projects at a glance.
      </p>

      {activeClients.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No clients yet</p>
          <p className="text-xs text-[var(--ink-muted)]">
            Create your first client project to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {activeClients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.slug}`}
              className="group flex items-center justify-between p-4 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] hover:shadow-card transition-shadow duration-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--muted)] flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-[var(--ink-muted)] truncate">
                    {client.industry || "No industry"} · {client.stage || "No stage"}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-120" strokeWidth={1.5} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
