import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { voiceParticipants, voiceSignals, chatChannels, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
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

  // Fetch participants
  const participants = await db
    .select()
    .from(voiceParticipants)
    .where(eq(voiceParticipants.channelId, channelId))
    .all();

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

  // If ?signals=true, also fetch and delete pending signals for this user
  const url = new URL(request.url);
  if (url.searchParams.get("signals") === "true") {
    const signals = await db
      .select()
      .from(voiceSignals)
      .where(
        and(
          eq(voiceSignals.channelId, channelId),
          eq(voiceSignals.toUserId, user.id)
        )
      )
      .all();

    // Delete fetched signals
    if (signals.length > 0) {
      for (const sig of signals) {
        await db.delete(voiceSignals).where(eq(voiceSignals.id, sig.id)).run();
      }
    }

    return NextResponse.json({ participants: enriched, signals });
  }

  return NextResponse.json({ participants: enriched });
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
  const { action } = body as { action: "join" | "leave" | "update" | "signal" };

  if (action === "join") {
    const { muted, deafened } = body as { muted?: boolean; deafened?: boolean };

    // Remove from any other voice channel first
    await db.delete(voiceParticipants).where(eq(voiceParticipants.userId, user.id)).run();

    await db
      .insert(voiceParticipants)
      .values({
        channelId,
        userId: user.id,
        joinedAt: new Date().toISOString(),
        muted: muted ?? false,
        deafened: deafened ?? false,
      })
      .run();

    // Return current participants so the joiner knows who to connect to
    const participants = await db
      .select()
      .from(voiceParticipants)
      .where(eq(voiceParticipants.channelId, channelId))
      .all();

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

    return NextResponse.json({ success: true, participants: enriched });
  }

  if (action === "leave") {
    await db
      .delete(voiceParticipants)
      .where(
        and(
          eq(voiceParticipants.channelId, channelId),
          eq(voiceParticipants.userId, user.id)
        )
      )
      .run();
    // Clean up any unread signals for this user in this channel
    await db
      .delete(voiceSignals)
      .where(
        and(
          eq(voiceSignals.channelId, channelId),
          eq(voiceSignals.toUserId, user.id)
        )
      )
      .run();
    return NextResponse.json({ success: true });
  }

  if (action === "update") {
    const { muted, deafened } = body as { muted?: boolean; deafened?: boolean };
    const updates: Partial<{ muted: boolean; deafened: boolean }> = {};
    if (muted !== undefined) updates.muted = muted;
    if (deafened !== undefined) updates.deafened = deafened;

    await db
      .update(voiceParticipants)
      .set(updates)
      .where(
        and(
          eq(voiceParticipants.channelId, channelId),
          eq(voiceParticipants.userId, user.id)
        )
      )
      .run();
    return NextResponse.json({ success: true });
  }

  if (action === "signal") {
    const { toUserId, type, payload } = body as {
      toUserId: string;
      type: string;
      payload: string;
    };

    await db
      .insert(voiceSignals)
      .values({
        id: crypto.randomUUID(),
        channelId,
        fromUserId: user.id,
        toUserId,
        type,
        payload,
        createdAt: new Date().toISOString(),
      })
      .run();

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
