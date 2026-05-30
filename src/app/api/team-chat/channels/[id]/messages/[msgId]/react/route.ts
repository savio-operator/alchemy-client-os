import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { chatReactions, chatChannelMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { msgId } = await params;

  const reactions = await db
    .select()
    .from(chatReactions)
    .where(eq(chatReactions.messageId, msgId))
    .all();

  // Group by emoji
  const grouped: Record<string, { emoji: string; count: number; userIds: string[]; hasMe: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], hasMe: false };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].userIds.push(r.userId);
    if (r.userId === user.id) grouped[r.emoji].hasMe = true;
  }

  return NextResponse.json(Object.values(grouped));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId, msgId } = await params;

  // Verify membership
  const membership = await db
    .select()
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .get();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = await request.json();
  const { emoji } = body as { emoji: string };

  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  // Toggle: check if this user already reacted with this emoji
  const existing = await db
    .select()
    .from(chatReactions)
    .where(
      and(
        eq(chatReactions.messageId, msgId),
        eq(chatReactions.userId, user.id),
        eq(chatReactions.emoji, emoji)
      )
    )
    .get();

  if (existing) {
    // Remove reaction
    await db.delete(chatReactions).where(eq(chatReactions.id, existing.id)).run();
    return NextResponse.json({ action: "removed", emoji });
  } else {
    // Add reaction
    const id = crypto.randomUUID();
    await db
      .insert(chatReactions)
      .values({ id, messageId: msgId, userId: user.id, emoji, createdAt: new Date().toISOString() })
      .run();
    return NextResponse.json({ action: "added", emoji, id });
  }
}
