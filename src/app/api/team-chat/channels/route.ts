import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  chatChannels,
  chatChannelMembers,
  chatMessages,
  users,
} from "@/db/schema";
import { eq, and, desc, count, gt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all channels the user is a member of
  const memberships = await db
    .select()
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.userId, user.id))
    .all();

  const channelIds = memberships.map((m) => m.channelId);
  if (channelIds.length === 0) {
    // Auto-create general channel if none exist
    const existing = await db
      .select()
      .from(chatChannels)
      .where(and(eq(chatChannels.type, "group"), eq(chatChannels.name, "General")))
      .get();

    if (!existing) {
      const channelId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(chatChannels).values({ id: channelId, type: "group", name: "General", createdAt: now }).run();

      // Add all active users
      const activeUsers = await db.select().from(users).where(eq(users.status, "active")).all();
      for (const u of activeUsers) {
        await db.insert(chatChannelMembers).values({ channelId, userId: u.id, joinedAt: now }).run();
      }

      return NextResponse.json([{ id: channelId, type: "group", name: "General", createdAt: now, unread: 0 }]);
    }

    // User exists but not in any channel — add to general
    await db.insert(chatChannelMembers).values({ channelId: existing.id, userId: user.id, joinedAt: new Date().toISOString() }).run();
    return NextResponse.json([{ ...existing, unread: 0 }]);
  }

  // Fetch channels with unread counts
  const result = [];
  for (const m of memberships) {
    const channel = await db.select().from(chatChannels).where(eq(chatChannels.id, m.channelId)).get();
    if (!channel) continue;

    const since = m.lastReadAt || "1970-01-01T00:00:00.000Z";
    const unreadResult = await db
      .select({ value: count() })
      .from(chatMessages)
      .where(and(eq(chatMessages.channelId, m.channelId), gt(chatMessages.createdAt, since)))
      .get();

    // For DMs, resolve the other user's name
    let displayName = channel.name;
    if (channel.type === "direct") {
      const otherMember = await db
        .select()
        .from(chatChannelMembers)
        .where(and(eq(chatChannelMembers.channelId, channel.id)))
        .all();
      const otherId = otherMember.find((m) => m.userId !== user.id)?.userId;
      if (otherId) {
        const otherUser = await db.select().from(users).where(eq(users.id, otherId)).get();
        displayName = otherUser?.name || "Unknown";
      }
    }

    result.push({
      ...channel,
      name: displayName,
      unread: unreadResult?.value ?? 0,
    });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { targetUserId, name, type: channelType } = body as {
    targetUserId?: string;
    name?: string;
    type?: string;
  };

  // Creating a named group or voice channel
  if ((channelType === "group" || channelType === "voice") && name) {
    if (user.role !== "founder" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const channelId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(chatChannels).values({ id: channelId, type: channelType, name: name.trim(), createdAt: now }).run();

    // Add all active users
    const activeUsers = await db.select().from(users).where(eq(users.status, "active")).all();
    for (const u of activeUsers) {
      await db.insert(chatChannelMembers).values({ channelId, userId: u.id, joinedAt: now }).run();
    }

    return NextResponse.json({ id: channelId, type: channelType, name: name.trim(), createdAt: now });
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  // Check if DM channel already exists between these two users
  const userChannels = await db
    .select()
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.userId, user.id))
    .all();

  for (const uc of userChannels) {
    const channel = await db.select().from(chatChannels).where(eq(chatChannels.id, uc.channelId)).get();
    if (channel?.type !== "direct") continue;

    const otherMember = await db
      .select()
      .from(chatChannelMembers)
      .where(and(eq(chatChannelMembers.channelId, channel.id), eq(chatChannelMembers.userId, targetUserId)))
      .get();

    if (otherMember) {
      return NextResponse.json({ id: channel.id, existing: true });
    }
  }

  // Create new DM channel
  const channelId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(chatChannels).values({ id: channelId, type: "direct", name: null, createdAt: now }).run();
  await db.insert(chatChannelMembers).values({ channelId, userId: user.id, joinedAt: now }).run();
  await db.insert(chatChannelMembers).values({ channelId, userId: targetUserId, joinedAt: now }).run();

  return NextResponse.json({ id: channelId, existing: false });
}
