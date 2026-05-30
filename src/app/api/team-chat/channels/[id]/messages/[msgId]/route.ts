import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { msgId } = await params;

  const msg = await db.select().from(chatMessages).where(eq(chatMessages.id, msgId)).get();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (msg.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { content } = body as { content: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db
    .update(chatMessages)
    .set({ content: content.trim(), editedAt: now })
    .where(eq(chatMessages.id, msgId))
    .run();

  return NextResponse.json({ ...msg, content: content.trim(), editedAt: now });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { msgId } = await params;

  const msg = await db.select().from(chatMessages).where(eq(chatMessages.id, msgId)).get();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = msg.userId === user.id;
  const isFounder = user.role === "founder";

  if (!isAuthor && !isFounder) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(chatMessages).where(eq(chatMessages.id, msgId)).run();

  return NextResponse.json({ success: true });
}
