import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { db, sqlite } from "@/db";
import { discoveries } from "@/db/schema";
import { loadSources } from "@/lib/sources";
import crypto from "crypto";

const rssParser = new RSSParser();

export async function POST() {
  const sources = loadSources();
  let fetched = 0;

  for (const source of sources) {
    if (source.type !== "rss" && source.type !== "kym") continue;

    const url = source.config.url as string;
    if (!url) continue;

    try {
      const feed = await rssParser.parseURL(url);

      for (const item of feed.items.slice(0, 20)) {
        const externalId = item.guid || item.link || item.title || "";
        if (!externalId) continue;

        const existing = sqlite
          .prepare("SELECT id FROM discoveries WHERE source_name = ? AND external_id = ?")
          .get(source.name, externalId);
        if (existing) continue;

        const id = crypto.randomUUID();
        db.insert(discoveries)
          .values({
            id,
            sourceName: source.name,
            sourceType: source.type,
            externalId,
            author: item.creator || item.author || null,
            title: item.title || null,
            body: (item.contentSnippet || item.content || "")
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 2000),
            externalUrl: item.link || null,
            rawJson: JSON.stringify(item),
            fetchedAt: new Date().toISOString(),
            popularityScore: null,
          })
          .run();
        fetched++;
      }
    } catch {
      // Skip failed sources
    }
  }

  return NextResponse.json({ fetched, sources: sources.length });
}
