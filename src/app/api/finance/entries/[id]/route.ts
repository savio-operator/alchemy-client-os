import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeEntries } from "@/db/schema";
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
  const body = await request.json();

  // Any founder can edit any finance entry
  const existing = await db
    .select()
    .from(financeEntries)
    .where(eq(financeEntries.id, id))
    .get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of ["date", "type", "description", "category", "amount", "client", "notes"] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.date) updates.month = body.date.slice(0, 7);

  await db.update(financeEntries).set(updates).where(eq(financeEntries.id, id)).run();

  const updated = await db.select().from(financeEntries).where(eq(financeEntries.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { id } = await params;
  // Any founder can delete any finance entry
  await db.delete(financeEntries).where(eq(financeEntries.id, id)).run();

  return NextResponse.json({ ok: true });
}
