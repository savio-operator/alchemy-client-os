import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, ideas } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.clientId, client.id))
    .orderBy(asc(ideas.sortOrder))
    .all();

  return NextResponse.json(allIdeas);
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

  // Get max sort order for the target column
  const allClientIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.clientId, client.id))
    .all();
  const maxOrder = allClientIdeas.reduce((max, i) => Math.max(max, i.sortOrder), -1);

  await db.insert(ideas)
    .values({
      id,
      clientId: client.id,
      title: body.title || "Untitled",
      body: body.body || null,
      column: body.column || "raw",
      tags: body.tags ? JSON.stringify(body.tags) : null,
      isOnline: body.isOnline ?? true,
      estimatedCost: body.estimatedCost ?? null,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = await db.select().from(ideas).where(eq(ideas.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}
