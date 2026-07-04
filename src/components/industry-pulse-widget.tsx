"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Newspaper } from "lucide-react";
import type { NewsItem } from "@/db/schema";
import { QuickLook } from "@/components/quick-look";
import { ShareToChatButton } from "@/components/share-to-chat";

function formatRelativeDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Home dashboard "Industry Pulse" widget. Clicking a headline opens the same
 * Quick Look reader used on the news feed, instead of navigating away.
 */
export function IndustryPulseWidget({ items }: { items: NewsItem[] }) {
  const [previewItem, setPreviewItem] = useState<NewsItem | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)] uppercase tracking-wide flex items-center gap-2">
          <Newspaper className="w-4 h-4" strokeWidth={1.5} />
          Industry Pulse
        </h2>
        <Link
          href="/news"
          className="text-xs text-[var(--theme-accent)] hover:underline flex items-center gap-1"
        >
          Open feed
          <ArrowRight className="w-3 h-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => item.url && setPreviewItem(item)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && item.url) {
                e.preventDefault();
                setPreviewItem(item);
              }
            }}
            className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--muted)] transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate group-hover:text-[var(--theme-accent)] transition-colors">
                {item.title}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                {item.source} · {item.category} · {formatRelativeDate(item.publishedAt || item.fetchedAt)}
              </p>
            </div>
            {item.url && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <ShareToChatButton title={item.title} url={item.url} source={item.source} />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open on original site"
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg)]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.8} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewItem?.url && (
        <QuickLook
          url={previewItem.url}
          title={previewItem.title}
          source={previewItem.source}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </section>
  );
}
