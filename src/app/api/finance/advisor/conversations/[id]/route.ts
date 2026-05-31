import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeConversations, financeMessages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { id } = await params;

  const conv = await db
    .select()
    .from(financeConversations)
    .where(and(eq(financeConversations.id, id), eq(financeConversations.userId, user.id)))
    .get();

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db
    .select()
    .from(financeMessages)
    .where(eq(financeMessages.conversationId, id))
    .orderBy(asc(financeMessages.createdAt))
    .all();

  return NextResponse.json({ ...conv, messages });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { id } = await params;
  await db
    .delete(financeConversations)
    .where(and(eq(financeConversations.id, id), eq(financeConversations.userId, user.id)))
    .run();

  return NextResponse.json({ ok: true });
}
