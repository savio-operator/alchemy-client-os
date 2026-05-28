import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chatChannelMembers, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  // Verify membership
  const membership = await db
    .select()
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .get();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limit = parseInt(searchParams.get("limit") || "50");

  let msgs;
  if (before) {
    const allMsgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.channelId, channelId))
      .orderBy(desc(chatMessages.createdAt))
      .all();
    const idx = allMsgs.findIndex((m) => m.createdAt < before);
    msgs = idx >= 0 ? allMsgs.slice(idx, idx + limit) : [];
  } else {
    msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.channelId, channelId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .all();
  }

  // Resolve user names
  const userIds = [...new Set(msgs.map((m) => m.userId))];
  const userMap = new Map<string, string>();
  for (const uid of userIds) {
    const u = await db.select().from(users).where(eq(users.id, uid)).get();
    if (u) userMap.set(uid, u.name);
  }

  const result = msgs.reverse().map((m) => ({
    ...m,
    userName: userMap.get(m.userId) || "Unknown",
  }));

  // Update last_read_at
  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: new Date().toISOString() })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .run();

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  // Verify membership
  const membership = await db
    .select()
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .get();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = await request.json();
  const { content, mediaUrl, mediaType, replyToId } = body as {
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    replyToId?: string;
  };

  if (!content?.trim() && !mediaUrl) {
    return NextResponse.json({ error: "Content or media required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const mediaExpiresAt = mediaUrl
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const msgId = crypto.randomUUID();
  await db
    .insert(chatMessages)
    .values({
      id: msgId,
      channelId,
      userId: user.id,
      content: content?.trim() || "",
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaExpiresAt,
      replyToId: replyToId || null,
      createdAt: now,
    })
    .run();

  // Update sender's last_read_at
  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: now })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .run();

  return NextResponse.json({
    id: msgId,
    channelId,
    userId: user.id,
    userName: user.name,
    content: content?.trim() || "",
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    mediaExpiresAt,
    replyToId: replyToId || null,
    createdAt: now,
  });
}
