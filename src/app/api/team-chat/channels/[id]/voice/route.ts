import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { voiceParticipants, chatChannels, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const channel = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).get();
  if (!channel || channel.type !== "voice") {
    return NextResponse.json({ error: "Voice channel not found" }, { status: 404 });
  }

  const participants = await db.select().from(voiceParticipants).where(eq(voiceParticipants.channelId, channelId)).all();

  const enriched = await Promise.all(
    participants.map(async (p) => {
      const u = await db.select().from(users).where(eq(users.id, p.userId)).get();
      return {
        userId: p.userId,
        name: u?.name || "Unknown",
        role: u?.role || "member",
        joinedAt: p.joinedAt,
        muted: p.muted,
        deafened: p.deafened,
      };
    })
  );

  return NextResponse.json(enriched);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const channel = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).get();
  if (!channel || channel.type !== "voice") {
    return NextResponse.json({ error: "Voice channel not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action, muted, deafened } = body as {
    action: "join" | "leave" | "update";
    muted?: boolean;
    deafened?: boolean;
  };

  if (action === "join") {
    // Remove from any other voice channel first
    await db.delete(voiceParticipants).where(eq(voiceParticipants.userId, user.id)).run();

    await db.insert(voiceParticipants).values({
      channelId,
      userId: user.id,
      joinedAt: new Date().toISOString(),
      muted: muted ?? false,
      deafened: deafened ?? false,
    }).run();
  } else if (action === "leave") {
    await db.delete(voiceParticipants).where(
      and(eq(voiceParticipants.channelId, channelId), eq(voiceParticipants.userId, user.id))
    ).run();
  } else if (action === "update") {
    const updates: Partial<{ muted: boolean; deafened: boolean }> = {};
    if (muted !== undefined) updates.muted = muted;
    if (deafened !== undefined) updates.deafened = deafened;

    await db.update(voiceParticipants)
      .set(updates)
      .where(and(eq(voiceParticipants.channelId, channelId), eq(voiceParticipants.userId, user.id)))
      .run();
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
