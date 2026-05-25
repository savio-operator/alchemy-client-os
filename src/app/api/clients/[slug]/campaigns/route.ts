import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.clientId, client.id))
    .orderBy(desc(campaigns.createdAt))
    .all();

  return NextResponse.json(allCampaigns);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(campaigns)
    .values({
      id,
      clientId: client.id,
      type: body.type || "online",
      objective: body.objective || null,
      channel: body.channel || null,
      hypothesis: body.hypothesis || null,
      creativeNotes: body.creativeNotes || null,
      budget: body.budget ?? null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      kpi: body.kpi || null,
      outcome: body.outcome || null,
      status: body.status || "planned",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}
