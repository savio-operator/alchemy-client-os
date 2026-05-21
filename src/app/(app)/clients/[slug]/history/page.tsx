"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  X,
  Trash2,
  StickyNote,
  Users,
  Trophy,
  ThumbsDown,
  Gavel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RichEditor } from "@/components/rich-editor";
import type { HistoryEntry } from "@/db/schema";

const ENTRY_TYPES = ["Note", "Meeting", "Win", "Loss", "Decision"] as const;

const TYPE_ICONS: Record<string, React.ElementType> = {
  Note: StickyNote,
  Meeting: Users,
  Win: Trophy,
  Loss: ThumbsDown,
  Decision: Gavel,
};

const TYPE_COLORS: Record<string, string> = {
  Note: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Meeting: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Win: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  Loss: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  Decision: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default function HistoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [newType, setNewType] = useState<string>("Note");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("type", filter);
    if (search.trim()) params.set("q", search.trim());

    const res = await fetch(`/api/clients/${slug}/history?${params}`);
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }, [slug, filter, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async () => {
    if (!newTitle.trim() && !newBody.trim()) return;

    await fetch(`/api/clients/${slug}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        title: newTitle.trim() || null,
        body: newBody || null,
      }),
    });

    setNewTitle("");
    setNewBody("");
    setShowComposer(false);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/clients/${slug}/history/${id}`, { method: "DELETE" });
    fetchEntries();
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-serif">History</h1>
        <Button
          size="sm"
          onClick={() => setShowComposer(!showComposer)}
          className="gap-1 bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          New entry
        </Button>
      </div>

      {/* Composer */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5 space-y-3">
              {/* Type selector */}
              <div className="flex items-center gap-2">
                {ENTRY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-120 ${
                      newType === t
                        ? TYPE_COLORS[t]
                        : "bg-[var(--muted)] text-[var(--ink-muted)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (optional)"
                className="text-sm"
              />

              <RichEditor
                content={newBody}
                onChange={setNewBody}
                placeholder="What happened?"
                minimal
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newTitle.trim() && !newBody.trim()}
                  className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                >
                  Save entry
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters + Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors duration-120 ${
              !filter
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "bg-[var(--muted)] text-[var(--ink-muted)] hover:bg-[var(--muted)]"
            }`}
          >
            All
          </button>
          {ENTRY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? null : t)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors duration-120 ${
                filter === t
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--muted)] text-[var(--ink-muted)] hover:bg-[var(--muted)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchEntries()}
            placeholder="Search..."
            className="h-8 pl-8 text-xs"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); fetchEntries(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Entries feed */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
          <p className="text-sm font-medium mb-1">No entries yet</p>
          <p className="text-xs text-[var(--ink-muted)]">
            Record your first note, meeting, or decision.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] || StickyNote;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="group rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs gap-1 ${TYPE_COLORS[entry.type] || ""}`}>
                      <Icon className="w-3 h-3" strokeWidth={1.5} />
                      {entry.type}
                    </Badge>
                    <span className="text-xs text-[var(--ink-muted)]">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-all duration-120"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                  </button>
                </div>

                {entry.title && (
                  <h3 className="text-sm font-medium mb-1">{entry.title}</h3>
                )}

                {entry.body && (
                  <div
                    className="text-sm text-[var(--ink-muted)] prose-measure [&_p]:mb-1 [&_strong]:text-[var(--ink)] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ __html: entry.body }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
