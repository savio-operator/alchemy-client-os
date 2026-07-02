"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Hash,
  Newspaper,
} from "lucide-react";
import type { NewsItem } from "@/db/schema";

const CATEGORY_STYLES: Record<string, string> = {
  branding: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  marketing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  advertising: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  adtech: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  social: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const POLL_INTERVAL = 60_000;

function NewsFeed() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "all";

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchNews = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== "all") params.set("category", category);
        if (debouncedSearch) params.set("q", debouncedSearch);
        const res = await fetch(`/api/news?${params}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } finally {
        setLoading(false);
      }
    },
    [category, debouncedSearch]
  );

  // Initial load + reload on filter change
  useEffect(() => {
    fetchNews(true);
  }, [fetchNews]);

  // Live polling
  useEffect(() => {
    const interval = setInterval(() => fetchNews(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/news", { method: "POST" });
      await fetchNews(false);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Channel-style header */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-1.5">
          <Hash className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={2} />
          {category === "all" ? "all-news" : category}
        </h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--presence)] animate-live-pulse" />
            Live
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
            aria-label="Refresh feed"
          >
            <RefreshCw
              className={`w-4 h-4 text-[var(--ink-muted)] ${refreshing ? "animate-spin" : ""}`}
              strokeWidth={1.8}
            />
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-muted)] mb-4">
        Live branding, marketing &amp; advertising news from across the internet
      </p>

      {/* Search */}
      <div className="relative mb-5">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)]"
          strokeWidth={1.8}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search headlines…"
          className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--rule)] bg-[var(--surface)] text-sm outline-none focus:border-[var(--theme-accent)]"
        />
      </div>

      {/* Feed */}
      {loading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <Newspaper className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium mb-1">No stories yet</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {debouncedSearch
              ? "Nothing matches your search."
              : "The feed is warming up — hit refresh in a moment."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const categoryStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.general;
  const isHot = item.score >= 8;

  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-4 hover:border-[var(--theme-accent)]/40 hover:shadow-card transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-[var(--ink)]">
              {item.source}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">
              {timeAgo(item.publishedAt || item.fetchedAt)}
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${categoryStyle}`}
            >
              {item.category}
            </span>
            {isHot && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#e01e5a]/10 text-[#e01e5a]">
                important
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold leading-snug mb-1 group-hover:text-[var(--theme-accent)] transition-colors">
            {item.title}
          </h3>
          {item.summary && (
            <p className="text-sm text-[var(--ink-muted)] line-clamp-2">
              {item.summary}
            </p>
          )}
        </div>
        <ExternalLink
          className="w-4 h-4 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
          strokeWidth={1.8}
        />
      </div>
    </a>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-4 animate-pulse"
        >
          <div className="h-3 w-32 bg-[var(--muted)] rounded mb-2.5" />
          <div className="h-4 w-3/4 bg-[var(--muted)] rounded mb-2" />
          <div className="h-3 w-full bg-[var(--muted)] rounded" />
        </div>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function NewsPage() {
  return (
    <Suspense fallback={null}>
      <NewsFeed />
    </Suspense>
  );
}
