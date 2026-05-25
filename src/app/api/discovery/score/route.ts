import { NextResponse } from "next/server";
import { db, queryAll } from "@/db";
import { clients, clientBrief, clientDiscoveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callAI } from "@/lib/anthropic";
import crypto from "crypto";

export async function POST() {
  const allClients = await db.select().from(clients);
  let scored = 0;

  for (const client of allClients) {
    if (client.archivedAt) continue;

    const brief = await db
      .select()
      .from(clientBrief)
      .where(eq(clientBrief.clientId, client.id))
      .get();

    if (!brief?.summaryMd) continue;

    const unscored = await queryAll<{
      id: string;
      title: string | null;
      body: string | null;
      source_name: string;
      source_type: string;
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
    ].filter(Boolean).join("\n\n");

    const items = unscored.map((d, i) => ({
      index: i,
      title: d.title || "(no title)",
      body: (d.body || "").slice(0, 500),
      source: d.source_name,
    }));

    try {
      const result = await callAI(
        `You are a relevance scoring agent. Score each item's relevance to the client brief.
For each item return: {"index": N, "score": 0-10, "tags": ["tag1"], "why": "one sentence"}.
Return a JSON array only. Be strict — most items score 3-5.`,
        `CLIENT BRIEF:\n${briefContext}\n\nITEMS:\n${JSON.stringify(items, null, 2)}`
      );

      const scores: Array<{ index: number; score: number; tags: string[]; why: string }> = JSON.parse(result);

      for (const score of scores) {
        const discovery = unscored[score.index];
        if (!discovery) continue;

        await db.insert(clientDiscoveries)
          .values({
            id: crypto.randomUUID(),
            clientId: client.id,
            discoveryId: discovery.id,
            score: score.score,
            tags: JSON.stringify(score.tags || []),
            whyMd: score.why || null,
            surfacedAt: score.score >= 7 ? null : new Date().toISOString(),
          });
        scored++;
      }
    } catch {
      // AI scoring failed
    }
  }

  return NextResponse.json({ scored });
}
