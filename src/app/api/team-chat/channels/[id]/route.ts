import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { chatChannels, chatChannelMembers, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
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

  const channel = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId))
    .get();

  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, description, isPrivate } = body as { name?: string; description?: string; isPrivate?: boolean };

  const updates: Partial<{ name: string; description: string; isPrivate: boolean }> = {};

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    updates.name = name.trim();
  }
  if (description !== undefined) updates.description = description;
  if (isPrivate !== undefined) updates.isPrivate = isPrivate;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .update(chatChannels)
    .set(updates)
    .where(eq(chatChannels.id, channelId))
    .run();

  return NextResponse.json({ ...channel, ...updates });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: channelId } = await params;

  // Don't allow deleting General channel
  const channel = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId))
    .get();

  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (channel.name === "General") {
    return NextResponse.json({ error: "Cannot delete General channel" }, { status: 400 });
  }

  // Cascade handled by FK, but delete explicitly for libsql
  await db.delete(chatMessages).where(eq(chatMessages.channelId, channelId)).run();
  await db.delete(chatChannelMembers).where(eq(chatChannelMembers.channelId, channelId)).run();
  await db.delete(chatChannels).where(eq(chatChannels.id, channelId)).run();

  return NextResponse.json({ success: true });
}
