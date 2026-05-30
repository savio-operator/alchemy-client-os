import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { chatChannelMembers, users, userPresence } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const members = await db
    .select()
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.channelId, channelId))
    .all();

  const result = await Promise.all(
    members.map(async (m) => {
      const u = await db.select().from(users).where(eq(users.id, m.userId)).get();
      const presence = await db
        .select()
        .from(userPresence)
        .where(eq(userPresence.userId, m.userId))
        .get();

      return {
        userId: m.userId,
        name: u?.name || "Unknown",
        role: u?.role || "member",
        status: presence?.status || "offline",
        lastSeenAt: presence?.lastSeenAt || null,
        joinedAt: m.joinedAt,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: channelId } = await params;
  const body = await request.json();
  const { userId } = body as { userId: string };

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const existing = await db
    .select()
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .get();

  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  await db
    .insert(chatChannelMembers)
    .values({ channelId, userId, joinedAt: new Date().toISOString() })
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: channelId } = await params;
  const body = await request.json();
  const { userId } = body as { userId: string };

  await db
    .delete(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .run();

  return NextResponse.json({ success: true });
}
