"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Bookmark,
  X,
  Sparkles,
  Filter,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuickLook } from "@/components/quick-look";
import { ShareToChatButton } from "@/components/share-to-chat";

interface DiscoveryItem {
  id: string;
  clientId: string;
  discoveryId: string;
  score: number;
  tags: string | null;
  whyMd: string | null;
  surfacedAt: string | null;
  dismissedAt: string | null;
  savedAt: string | null;
  discovery: {
    id: string;
    sourceName: string;
    sourceType: string;
    author: string | null;
    title: string | null;
    body: string | null;
    externalUrl: string | null;
    fetchedAt: string;
  };
}

const TYPE_LABELS: Record<string, string> = {
  reddit: "Post",
  rss: "Article",
  kym: "Meme",
  twitter_list: "Tweet",
  google_trends: "Trend",
};

export default function FeedPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(5);
  const [previewItem, setPreviewItem] = useState<DiscoveryItem | null>(null);

  const fetchFeed = useCallback(async () => {
    const res = await fetch(
      `/api/clients/${slug}/discoveries?minScore=${minScore}`
    );
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, [slug, minScore]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleDismiss = async (id: string) => {
    await fetch(`/api/clients/${slug}/discoveries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: true }),
    });
    setItems(items.filter((i) => i.id !== id));
  };

  const handleSave = async (id: string) => {
    await fetch(`/api/clients/${slug}/discoveries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ save: true }),
    });
    setItems(
      items.map((i) =>
        i.id === id ? { ...i, savedAt: new Date().toISOString() } : i
      )
    );
  };

  const filteredItems = typeFilter
    ? items.filter((i) => i.discovery.sourceType === typeFilter)
    : items;

  const sourceTypes = [...new Set(items.map((i) => i.discovery.sourceType))];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-serif">Feed</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            Real content from the web, scored for this client.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors duration-120 ${
            !typeFilter
              ? "bg-[var(--ink)] text-[var(--bg)]"
              : "bg-[var(--muted)] text-[var(--ink-muted)]"
          }`}
        >
          All
        </button>
        {sourceTypes.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors duration-120 ${
              typeFilter === t
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "bg-[var(--muted)] text-[var(--ink-muted)]"
            }`}
          >
            {TYPE_LABELS[t] || t}
          </button>
        ))}

        <div className="flex-1" />

        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          Min score:
          <select
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value))}
            className="bg-[var(--surface)] border border-[var(--rule)] rounded px-1.5 py-0.5 text-xs"
          >
            {[0, 3, 5, 7, 8, 9].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No discoveries yet</p>
          <p className="text-xs text-[var(--ink-muted)] max-w-xs mx-auto">
            The discovery engine will surface real content from Reddit, RSS feeds, and meme trackers once it starts polling. Configure your sources in the Agents section.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const tags: string[] = item.tags ? JSON.parse(item.tags) : [];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="group rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {TYPE_LABELS[item.discovery.sourceType] || item.discovery.sourceType}
                    </Badge>
                    <span className="text-xs text-[var(--ink-muted)]">
                      {item.discovery.sourceName}
                    </span>
                    {item.discovery.author && (
                      <span className="text-xs text-[var(--ink-muted)]">
                        by {item.discovery.author}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-medium text-[var(--accent-clay)]">
                      {item.score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                {item.discovery.title && (
                  <h3
                    className={`text-sm font-medium mb-1 ${
                      item.discovery.externalUrl
                        ? "cursor-pointer hover:text-[var(--accent-clay)] transition-colors"
                        : ""
                    }`}
                    onClick={() =>
                      item.discovery.externalUrl && setPreviewItem(item)
                    }
                  >
                    {item.discovery.title}
                  </h3>
                )}
                {item.discovery.body && (
                  <p className="text-sm text-[var(--ink-muted)] line-clamp-3 mb-2">
                    {item.discovery.body}
                  </p>
                )}

                {/* Why it matters */}
                {item.whyMd && (
                  <div className="text-xs bg-[var(--accent-clay)]/5 text-[var(--accent-clay)] px-3 py-2 rounded-[var(--radius-sm)] mb-2">
                    {item.whyMd}
                  </div>
                )}

                {/* Tags + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-120">
                    {item.discovery.externalUrl && (
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                        title="Quick Look"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                      </button>
                    )}
                    {item.discovery.externalUrl && (
                      <a
                        href={item.discovery.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                      </a>
                    )}
                    {item.discovery.externalUrl && (
                      <ShareToChatButton
                        title={item.discovery.title || item.discovery.sourceName}
                        url={item.discovery.externalUrl}
                        source={item.discovery.sourceName}
                        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                      />
                    )}
                    <button
                      onClick={() => handleSave(item.id)}
                      className={`w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] ${
                        item.savedAt ? "text-[var(--accent-clay)]" : ""
                      }`}
                      title="Save to Ideas"
                    >
                      <Bookmark
                        className="w-3.5 h-3.5"
                        strokeWidth={1.5}
                        fill={item.savedAt ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={() => handleDismiss(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {previewItem?.discovery.externalUrl && (
        <QuickLook
          url={previewItem.discovery.externalUrl}
          title={previewItem.discovery.title}
          source={previewItem.discovery.sourceName}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
