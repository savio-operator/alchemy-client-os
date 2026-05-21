import { NextResponse } from "next/server";
import { db, indexHistoryEntry } from "@/db";
import { historyEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  const { entryId } = await params;
  const body = await request.json();

  db.update(historyEntries)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(historyEntries.id, entryId))
    .run();

  if (body.title !== undefined || body.body !== undefined) {
    const entry = db.select().from(historyEntries).where(eq(historyEntries.id, entryId)).get();
    if (entry) {
      indexHistoryEntry(entryId, entry.title, entry.body);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  const { entryId } = await params;
  db.delete(historyEntries).where(eq(historyEntries.id, entryId)).run();
  return NextResponse.json({ success: true });
}
