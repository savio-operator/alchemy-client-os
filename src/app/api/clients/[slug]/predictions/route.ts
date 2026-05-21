import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientBrief, historyEntries, campaigns, predictions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { callAI } from "@/lib/anthropic";
import { getAgent } from "@/lib/agents";
import crypto from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latest = db
    .select()
    .from(predictions)
    .where(eq(predictions.clientId, client.id))
    .orderBy(desc(predictions.createdAt))
    .limit(1)
    .get();

  return NextResponse.json(latest || null);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brief = db.select().from(clientBrief).where(eq(clientBrief.clientId, client.id)).get();
  const history = db
    .select()
    .from(historyEntries)
    .where(eq(historyEntries.clientId, client.id))
    .orderBy(desc(historyEntries.createdAt))
    .limit(20)
    .all();
  const clientCampaigns = db
    .select()
    .from(campaigns)
    .where(eq(campaigns.clientId, client.id))
    .all();

  const agent = getAgent("forecaster");
  const systemPrompt = agent?.systemPrompt || "Generate a 90-day marketing outlook based on the provided data.";

  const context = JSON.stringify({
    client: { name: client.name, industry: client.industry, stage: client.stage },
    brief: brief || {},
    recentHistory: history.map((h) => ({ type: h.type, title: h.title, date: h.createdAt })),
    campaigns: clientCampaigns.map((c) => ({
      type: c.type,
      objective: c.objective,
      status: c.status,
      budget: c.budget,
      outcome: c.outcome,
    })),
  }, null, 2);

  try {
    const forecast = await callAI(systemPrompt, context);

    const id = crypto.randomUUID();
    db.insert(predictions)
      .values({
        id,
        clientId: client.id,
        forecastMd: forecast,
        createdAt: new Date().toISOString(),
      })
      .run();

    return NextResponse.json({ id, forecastMd: forecast, createdAt: new Date().toISOString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forecast generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
