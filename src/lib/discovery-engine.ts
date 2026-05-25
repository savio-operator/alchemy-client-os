import cron from "node-cron";
import RSSParser from "rss-parser";
import { db, queryOne, queryAll } from "@/db";
import {
  clients,
  clientBrief,
  discoveries,
  clientDiscoveries,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadSources, type SourceConfig } from "@/lib/sources";
import { callAI } from "@/lib/anthropic";
import crypto from "crypto";

const rssParser = new RSSParser();

// Track last poll times
const lastPolled = new Map<string, number>();

let engineStarted = false;

export function startDiscoveryEngine() {
  if (engineStarted) return;
  engineStarted = true;

  // Poll every 10 minutes, check which sources are due
  cron.schedule("*/10 * * * *", async () => {
    await runPollingCycle();
  });

  // Run initial poll after a short delay
  setTimeout(() => runPollingCycle(), 5000);
}

async function runPollingCycle() {
  const sources = loadSources();
  const now = Date.now();

  for (const source of sources) {
    const last = lastPolled.get(source.name) || 0;
    const intervalMs = source.pollMinutes * 60 * 1000;

    if (now - last < intervalMs) continue;

    lastPolled.set(source.name, now);

    try {
      await fetchSource(source);
    } catch {
      // Silently skip failed sources
    }
  }

  // After fetching, run relevance scoring for new discoveries
  await scoreNewDiscoveries();
}

async function fetchSource(source: SourceConfig) {
  switch (source.type) {
    case "rss":
    case "kym":
      await fetchRSS(source);
      break;
    // Reddit, Twitter, etc. require API keys — skip if not configured
    case "reddit":
    case "twitter_list":
    case "google_trends":
    case "playwright":
      // These require additional configuration/APIs
      break;
  }
}

async function fetchRSS(source: SourceConfig) {
  const url = source.config.url as string;
  if (!url) return;

  const feed = await rssParser.parseURL(url);

  for (const item of feed.items.slice(0, 20)) {
    const externalId = item.guid || item.link || item.title || "";
    if (!externalId) continue;

    // Check for duplicate
    const existing = await queryOne(
      "SELECT id FROM discoveries WHERE source_name = ? AND external_id = ?",
      source.name,
      externalId
    );

    if (existing) continue;

    // For KYM, filter by status and age
    if (source.type === "kym") {
      const filterStatus = (source.config.filter_status as string[]) || [];
      const maxAgeDays = (source.config.max_age_days as number) || 7;

      if (item.pubDate) {
        const pubDate = new Date(item.pubDate);
        const ageDays =
          (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > maxAgeDays) continue;
      }

      // KYM status is typically in categories or content
      if (filterStatus.length > 0 && item.categories) {
        const hasStatus = item.categories.some((cat: string) =>
          filterStatus.some(
            (s) => cat.toLowerCase().includes(s.toLowerCase())
          )
        );
        if (!hasStatus) continue;
      }
    }

    const id = crypto.randomUUID();
    await db.insert(discoveries)
      .values({
        id,
        sourceName: source.name,
        sourceType: source.type,
        externalId,
        author: item.creator || item.author || null,
        title: item.title || null,
        body: stripHtml(item.contentSnippet || item.content || "").slice(
          0,
          2000
        ),
        externalUrl: item.link || null,
        rawJson: JSON.stringify(item),
        fetchedAt: new Date().toISOString(),
        popularityScore: null,
      });
  }
}

export async function scoreNewDiscoveries() {
  // Get all unscored discoveries (not yet in client_discoveries for any client)
  const allClients = await db.select().from(clients);
  if (allClients.length === 0) return;

  for (const client of allClients) {
    if (client.archivedAt) continue;

    const brief = await db
      .select()
      .from(clientBrief)
      .where(eq(clientBrief.clientId, client.id))
      .get();

    if (!brief?.summaryMd) continue;

    // Get discoveries not yet scored for this client
    const unscored = await queryAll<{
      id: string;
      title: string | null;
      body: string | null;
      source_name: string;
      source_type: string;
      external_url: string | null;
    }>(
      `SELECT d.* FROM discoveries d
       WHERE d.id NOT IN (
         SELECT discovery_id FROM client_discoveries WHERE client_id = ?
       )
       ORDER BY d.fetched_at DESC
       LIMIT 20`,
      client.id
    );

    if (unscored.length === 0) continue;

    const briefContext = [
      brief.summaryMd,
      brief.northStar ? `North star: ${brief.northStar}` : "",
      brief.audience ? `Audience: ${brief.audience}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const items = unscored.map((d, i) => ({
      index: i,
      title: d.title || "(no title)",
      body: (d.body || "").slice(0, 500),
      source: d.source_name,
      type: d.source_type,
    }));

    try {
      const result = await callAI(
        `You are a relevance scoring agent. Given a client brief and discovered content items, evaluate each item's relevance.

For each item, return a JSON object with:
- "index": the item index
- "score": 0-10 integer
- "tags": array of up to 3 tags
- "why": one sentence explaining relevance to THIS client

Return a JSON array. Be strict — most items score 3-5. Only truly relevant items score 7+.
Return ONLY the JSON array, no markdown.`,
        `CLIENT BRIEF:\n${briefContext}\n\nITEMS:\n${JSON.stringify(items, null, 2)}`
      );

      let scores: Array<{
        index: number;
        score: number;
        tags: string[];
        why: string;
      }>;
      try {
        scores = JSON.parse(result);
      } catch {
        continue;
      }

      for (const score of scores) {
        const discovery = unscored[score.index];
        if (!discovery) continue;

        const cdId = crypto.randomUUID();
        await db.insert(clientDiscoveries)
          .values({
            id: cdId,
            clientId: client.id,
            discoveryId: discovery.id,
            score: score.score,
            tags: JSON.stringify(score.tags || []),
            whyMd: score.why || null,
            surfacedAt:
              score.score >= 7 ? null : new Date().toISOString(),
          });
      }
    } catch {
      // AI scoring failed — skip this batch
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
