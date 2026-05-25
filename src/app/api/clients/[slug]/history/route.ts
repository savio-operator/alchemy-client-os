import { NextResponse } from "next/server";
import { db, indexHistoryEntry, searchHistory } from "@/db";
import { clients, historyEntries } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type");
  const search = url.searchParams.get("q");

  if (search) {
    const results = searchHistory(search, client.id);
    return NextResponse.json(results);
  }

  let entries;
  if (typeFilter) {
    entries = await db
      .select()
      .from(historyEntries)
      .where(and(eq(historyEntries.clientId, client.id), eq(historyEntries.type, typeFilter)))
      .orderBy(desc(historyEntries.createdAt))
      .all();
  } else {
    entries = await db
      .select()
      .from(historyEntries)
      .where(eq(historyEntries.clientId, client.id))
      .orderBy(desc(historyEntries.createdAt))
      .all();
  }

  return NextResponse.json(entries);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { type, title, body: entryBody } = body as {
    type: string;
    title?: string;
    body?: string;
  };

  if (!type) {
    return NextResponse.json({ error: "Type is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(historyEntries)
    .values({
      id,
      clientId: client.id,
      type,
      title: title || null,
      body: entryBody || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  indexHistoryEntry(id, title || null, entryBody || null);

  const created = await db.select().from(historyEntries).where(eq(historyEntries.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}
