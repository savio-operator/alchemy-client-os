/*
 * Live industry news engine.
 * Pulls branding / marketing / advertising coverage from two pipelines:
 *   1. RSS — trade publications (no API key required)
 *   2. NewsAPI.org — mainstream coverage (requires NEWSAPI_KEY)
 * Items are merged, deduped, then batch-classified by AI into categories
 * with an importance score and a one-line summary.
 */

import cron from "node-cron";
import RSSParser from "rss-parser";
import crypto from "crypto";
import { db, queryOne, initPromise } from "@/db";
import { newsItems } from "@/db/schema";
import { callAI } from "@/lib/anthropic";
import { sql, inArray } from "drizzle-orm";

const rssParser = new RSSParser({ timeout: 15_000 });

export const NEWS_CATEGORIES = [
  "branding",
  "marketing",
  "advertising",
  "adtech",
  "social",
  "general",
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

// Industry trade publications — all public RSS, no keys needed.
const RSS_SOURCES: { name: string; url: string }[] = [
  { name: "Adweek", url: "https://www.adweek.com/feed/" },
  { name: "Marketing Brew", url: "https://www.marketingbrew.com/feed" },
  { name: "The Drum", url: "https://www.thedrum.com/feeds/news" },
  { name: "Marketing Week", url: "https://www.marketingweek.com/feed/" },
  { name: "Campaign", url: "https://www.campaignlive.com/rss/latest" },
  { name: "MarTech", url: "https://martech.org/feed/" },
  { name: "Search Engine Land", url: "https://searchengineland.com/feed" },
  { name: "Social Media Today", url: "https://www.socialmediatoday.com/feeds/news/" },
  { name: "Marketing Dive", url: "https://www.marketingdive.com/feeds/news/" },
  { name: "Branding Strategy Insider", url: "https://brandingstrategyinsider.com/feed" },
  { name: "HubSpot Blog", url: "https://blog.hubspot.com/marketing/rss.xml" },
  { name: "Seth Godin", url: "https://seths.blog/feed/" },
];

const NEWSAPI_QUERIES = [
  '"advertising industry" OR "ad campaign" OR "advertising agency"',
  '"brand strategy" OR rebrand OR "brand identity"',
  '"digital marketing" OR "marketing campaign" OR adtech',
];

const FETCH_INTERVAL_MINUTES = 15;

let engineStarted = false;
let lastFetchAt = 0;
let fetchInFlight: Promise<void> | null = null;

export function startNewsEngine() {
  if (engineStarted) return;
  engineStarted = true;

  cron.schedule(`*/${FETCH_INTERVAL_MINUTES} * * * *`, () => {
    refreshNews().catch(() => {});
  });

  setTimeout(() => refreshNews().catch(() => {}), 3000);
}

/** Refresh if data is stale; awaitable so API routes can trigger it lazily. */
export async function ensureFreshNews(): Promise<void> {
  const stale = Date.now() - lastFetchAt > FETCH_INTERVAL_MINUTES * 60 * 1000;
  if (!stale) return;
  await refreshNews();
}

export async function refreshNews(): Promise<void> {
  // Coalesce concurrent refreshes
  if (fetchInFlight) return fetchInFlight;

  fetchInFlight = (async () => {
    await initPromise;
    lastFetchAt = Date.now();

    const inserted: string[] = [];

    // 1. RSS pipeline — fetch all feeds in parallel, tolerate failures
    const rssResults = await Promise.allSettled(
      RSS_SOURCES.map((s) => fetchRssSource(s))
    );
    for (const r of rssResults) {
      if (r.status === "fulfilled") inserted.push(...r.value);
    }

    // 2. NewsAPI pipeline (optional)
    if (process.env.NEWSAPI_KEY) {
      try {
        inserted.push(...(await fetchNewsApi()));
      } catch {
        // NewsAPI down or quota hit — RSS still works
      }
    }

    // 3. AI classification for whatever is new
    if (inserted.length > 0) {
      await classifyNewItems(inserted).catch(() => {});
    }

    // 4. Trim old items so the table doesn't grow unbounded
    await db.run(
      sql`DELETE FROM news_items WHERE fetched_at < datetime('now', '-14 days')`
    );
  })().finally(() => {
    fetchInFlight = null;
  });

  return fetchInFlight;
}

async function fetchRssSource(source: {
  name: string;
  url: string;
}): Promise<string[]> {
  const feed = await rssParser.parseURL(source.url);
  const ids: string[] = [];

  for (const item of feed.items.slice(0, 15)) {
    const externalId = normalizeId(item.link || item.guid || item.title || "");
    if (!externalId || !item.title) continue;

    const id = await insertIfNew({
      source: source.name,
      sourceType: "rss",
      externalId,
      title: item.title.trim(),
      summary: stripHtml(item.contentSnippet || item.content || "").slice(0, 400) || null,
      url: item.link || null,
      imageUrl: extractImage(item),
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    });
    if (id) ids.push(id);
  }
  return ids;
}

interface NewsApiArticle {
  source?: { name?: string };
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
}

async function fetchNewsApi(): Promise<string[]> {
  const key = process.env.NEWSAPI_KEY!;
  const ids: string[] = [];

  for (const query of NEWSAPI_QUERIES) {
    const params = new URLSearchParams({
      q: query,
      language: "en",
      sortBy: "publishedAt",
      pageSize: "20",
    });
    const res = await fetch(
      `https://newsapi.org/v2/everything?${params}`,
      { headers: { "X-Api-Key": key } }
    );
    if (!res.ok) continue;

    const data = (await res.json()) as { articles?: NewsApiArticle[] };
    for (const article of data.articles || []) {
      if (!article.title || !article.url) continue;
      // NewsAPI sometimes returns removed articles
      if (article.title === "[Removed]") continue;

      const id = await insertIfNew({
        source: article.source?.name || "NewsAPI",
        sourceType: "newsapi",
        externalId: normalizeId(article.url),
        title: article.title.trim(),
        summary: (article.description || "").slice(0, 400) || null,
        url: article.url,
        imageUrl: article.urlToImage || null,
        publishedAt: article.publishedAt || null,
      });
      if (id) ids.push(id);
    }
  }
  return ids;
}

async function insertIfNew(item: {
  source: string;
  sourceType: string;
  externalId: string;
  title: string;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
}): Promise<string | null> {
  // Dedupe across sources by URL/title hash as well as per-source id
  const titleHash = crypto
    .createHash("sha1")
    .update(item.title.toLowerCase().replace(/\W+/g, " ").trim())
    .digest("hex");

  const existing = await queryOne(
    `SELECT id FROM news_items
     WHERE (source = ? AND external_id = ?) OR external_id = ?`,
    item.source,
    item.externalId,
    titleHash
  );
  if (existing) return null;

  const id = crypto.randomUUID();
  await db.insert(newsItems).values({
    id,
    source: item.source,
    sourceType: item.sourceType,
    externalId: item.externalId || titleHash,
    title: item.title,
    summary: item.summary,
    url: item.url,
    imageUrl: item.imageUrl,
    category: "general",
    score: 5,
    publishedAt: item.publishedAt,
    fetchedAt: new Date().toISOString(),
  });
  return id;
}

/** Batch-classify new items: category + importance score + crisp summary. */
async function classifyNewItems(ids: string[]): Promise<void> {
  const BATCH = 25;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const items = await db
      .select({
        id: newsItems.id,
        title: newsItems.title,
        summary: newsItems.summary,
        source: newsItems.source,
      })
      .from(newsItems)
      .where(inArray(newsItems.id, batchIds))
      .all();
    if (items.length === 0) continue;

    const payload = items.map((r, idx) => ({
      index: idx,
      title: r.title,
      summary: (r.summary || "").slice(0, 200),
      source: r.source,
    }));

    try {
      const result = await callAI(
        `You classify industry news for a marketing/advertising agency's live feed.

For each item return JSON: {"index": n, "category": one of ["branding","marketing","advertising","adtech","social","general"], "score": 1-10 importance for agency professionals, "summary": one crisp sentence (max 140 chars) capturing why it matters}.

Category guide: branding = brand identity/strategy/rebrands; marketing = strategy/campaigns/growth/content; advertising = ads/agencies/media buying/creative; adtech = platforms/data/programmatic/measurement; social = social platforms & creators; general = everything else.

Return ONLY a JSON array.`,
        JSON.stringify(payload)
      );

      const cleaned = result.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
      const scores: Array<{
        index: number;
        category: string;
        score: number;
        summary: string;
      }> = JSON.parse(cleaned);

      for (const s of scores) {
        const item = items[s.index];
        if (!item) continue;
        const category = (NEWS_CATEGORIES as readonly string[]).includes(s.category)
          ? s.category
          : "general";
        await db.run(
          sql`UPDATE news_items SET category = ${category}, score = ${clampScore(s.score)}, summary = ${s.summary || null} WHERE id = ${item.id}`
        );
      }
    } catch {
      // Classification failed — items stay as "general" and still show in the feed
    }
  }
}

function clampScore(n: number): number {
  return Math.min(10, Math.max(1, Math.round(Number(n) || 5)));
}

function normalizeId(raw: string): string {
  return raw.replace(/[?#].*$/, "").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RssItemWithMedia {
  enclosure?: { url?: string };
  "media:content"?: { $?: { url?: string } };
}

function extractImage(item: unknown): string | null {
  const media = item as RssItemWithMedia;
  return media.enclosure?.url || media["media:content"]?.$?.url || null;
}
