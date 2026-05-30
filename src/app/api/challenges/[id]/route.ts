import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { challenges } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { id } = await params;
  const existing = await db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPrivileged = user.role === "founder" || user.role === "manager";
  const isAssigned = existing.assignedTo === user.id;

  if (!isPrivileged && !isAssigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { status, title, description, reward, dueDate } = body;

  const now = new Date().toISOString();
  const updates: Partial<typeof existing> = { updatedAt: now };

  if (status !== undefined) {
    updates.status = status;
    if (status === "completed" && !existing.completedAt) updates.completedAt = now;
    if (status !== "completed") updates.completedAt = null;
  }
  if (isPrivileged) {
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (reward !== undefined) updates.reward = reward;
    if (dueDate !== undefined) updates.dueDate = dueDate;
  }

  await db.update(challenges).set(updates).where(eq(challenges.id, id)).run();

  const updated = await db.select().from(challenges).where(eq(challenges.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Only founders/managers can delete challenges" }, { status: 403 });
  }

  await initPromise;

  const { id } = await params;
  const existing = await db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(challenges).where(eq(challenges.id, id)).run();

  return NextResponse.json({ success: true });
}
