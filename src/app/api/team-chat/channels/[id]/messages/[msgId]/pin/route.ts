import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { chatMessages, chatChannelMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _request: Request,
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

  // Only founders/managers can pin
  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const msg = await db.select().from(chatMessages).where(eq(chatMessages.id, msgId)).get();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCurrentlyPinned = !!msg.pinnedAt;

  if (isCurrentlyPinned) {
    await db
      .update(chatMessages)
      .set({ pinnedAt: null, pinnedBy: null })
      .where(eq(chatMessages.id, msgId))
      .run();
    return NextResponse.json({ pinned: false });
  } else {
    const now = new Date().toISOString();
    await db
      .update(chatMessages)
      .set({ pinnedAt: now, pinnedBy: user.id })
      .where(eq(chatMessages.id, msgId))
      .run();
    return NextResponse.json({ pinned: true, pinnedAt: now, pinnedBy: user.id });
  }
}
