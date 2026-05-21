"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useCommandPalette } from "@/store/command-palette";
import { Briefcase, Plus, Settings } from "lucide-react";
import type { Client } from "@/db/schema";

interface CommandPaletteProps {
  clients: Client[];
  onNewClient: () => void;
}

export function CommandPalette({ clients, onNewClient }: CommandPaletteProps) {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  if (!open) return null;

  const activeClients = clients.filter((c) => !c.archivedAt);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-0 flex items-start justify-center pt-[20vh]">
        <Command
          className="w-full max-w-lg bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-card border border-[var(--rule)] overflow-hidden animate-panel-in"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <Command.Input
            placeholder="Search clients, jump to section..."
            className="w-full h-12 px-4 text-sm bg-transparent border-b border-[var(--rule)] outline-none placeholder:text-[var(--ink-muted)]"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--ink-muted)]">
              No results found.
            </Command.Empty>

            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--ink-muted)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  onNewClient();
                }}
                className="flex items-center gap-2 h-9 px-2 text-sm rounded-[var(--radius-sm)] cursor-pointer data-[selected=true]:bg-[var(--muted)]"
              >
                <Plus className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                New client
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  router.push("/settings");
                }}
                className="flex items-center gap-2 h-9 px-2 text-sm rounded-[var(--radius-sm)] cursor-pointer data-[selected=true]:bg-[var(--muted)]"
              >
                <Settings className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                Settings
              </Command.Item>
            </Command.Group>

            {activeClients.length > 0 && (
              <Command.Group heading="Clients" className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--ink-muted)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {activeClients.map((client) => (
                  <Command.Item
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/clients/${client.slug}`);
                    }}
                    className="flex items-center gap-2 h-9 px-2 text-sm rounded-[var(--radius-sm)] cursor-pointer data-[selected=true]:bg-[var(--muted)]"
                  >
                    <Briefcase className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    {client.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
