"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useCommandPalette } from "@/store/command-palette";
import {
  Briefcase,
  Plus,
  Settings,
  Loader2,
  CheckSquare,
  Lightbulb,
  UserPlus,
  Megaphone,
  Receipt,
  Newspaper,
  Radar,
} from "lucide-react";
import type { Client } from "@/db/schema";
import type { GroupedSearchResults, SearchResult } from "@/lib/global-search";

interface CommandPaletteProps {
  clients: Client[];
  onNewClient: () => void;
}

const GROUP_META: Record<
  keyof GroupedSearchResults,
  { heading: string; icon: typeof Briefcase }
> = {
  clients: { heading: "Clients", icon: Briefcase },
  tasks: { heading: "Tasks", icon: CheckSquare },
  ideas: { heading: "Ideas", icon: Lightbulb },
  leads: { heading: "Leads", icon: UserPlus },
  campaigns: { heading: "Campaigns", icon: Megaphone },
  invoices: { heading: "Invoices", icon: Receipt },
  news: { heading: "Industry News", icon: Newspaper },
  feed: { heading: "Client Feed", icon: Radar },
};

export function CommandPalette({ clients, onNewClient }: CommandPaletteProps) {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GroupedSearchResults | null>(null);

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

  // Reset search state whenever the palette closes, so it reopens fresh.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Spotlight-style live search: debounced, across every content table in
  // the app — not just clients — via the shared /api/search endpoint.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data: GroupedSearchResults) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  if (!open) return null;

  const activeClients = clients.filter((c) => !c.archivedAt);
  const isSearching = query.trim().length >= 2;

  const goTo = (result: SearchResult) => {
    setOpen(false);
    router.push(result.link);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/40"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-0 flex items-start justify-center pt-[18vh] px-4">
        {/* Spotlight-style panel: frosted, floating, origin-centered pop */}
        <Command
          shouldFilter={false}
          className="w-full max-w-xl material-strong rounded-2xl shadow-elevated border border-[var(--rule)] overflow-hidden animate-sheet-in"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="relative">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search everything in Adchemy..."
              className="w-full h-13 px-5 text-base bg-transparent border-b border-[var(--rule)] outline-none placeholder:text-[var(--ink-muted)]"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--ink-muted)]" />
            )}
          </div>
          <Command.List className="max-h-96 overflow-y-auto p-2">
            {isSearching ? (
              searching && !results ? (
                <div className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  Searching…
                </div>
              ) : results && Object.values(results).every((r) => r.length === 0) ? (
                <div className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  No results found anywhere in the app.
                </div>
              ) : (
                results &&
                (Object.keys(GROUP_META) as Array<keyof GroupedSearchResults>).map((key) => {
                  const items = results[key];
                  if (items.length === 0) return null;
                  const { heading, icon: Icon } = GROUP_META[key];
                  return (
                    <Command.Group
                      key={key}
                      heading={heading}
                      className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--ink-muted)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                    >
                      {items.map((item) => (
                        <Command.Item
                          key={`${key}-${item.id}`}
                          value={`${key}-${item.id}`}
                          onSelect={() => goTo(item)}
                          className="flex items-center gap-2 h-9 px-2 text-sm rounded-[var(--radius-sm)] cursor-pointer data-[selected=true]:bg-[var(--muted)]"
                        >
                          <Icon className="w-4 h-4 text-[var(--ink-muted)] shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="ml-auto text-xs text-[var(--ink-muted)] truncate shrink-0 max-w-[40%]">
                              {item.subtitle}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })
              )
            ) : (
              <>
                <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--ink-muted)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  <Command.Item
                    value="new-client"
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
                    value="settings"
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
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
