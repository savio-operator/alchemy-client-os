import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, socialPosts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const posts = db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.clientId, client.id))
    .orderBy(desc(socialPosts.scheduledFor))
    .all();

  return NextResponse.json(posts);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(socialPosts)
    .values({
      id,
      clientId: client.id,
      platform: body.platform || "Instagram",
      copy: body.copy || null,
      mediaUrls: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
      scheduledFor: body.scheduledFor || null,
      status: body.status || "draft",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = db.select().from(socialPosts).where(eq(socialPosts.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}
