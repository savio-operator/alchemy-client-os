import { NextResponse } from "next/server";
import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; ideaId: string }> }
) {
  const { ideaId } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.body !== undefined) updateData.body = body.body;
  if (body.column !== undefined) updateData.column = body.column;
  if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
  if (body.isOnline !== undefined) updateData.isOnline = body.isOnline;
  if (body.estimatedCost !== undefined) updateData.estimatedCost = body.estimatedCost;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
  if (body.refinedBody !== undefined) updateData.refinedBody = body.refinedBody;

  await db.update(ideas).set(updateData).where(eq(ideas.id, ideaId)).run();
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; ideaId: string }> }
) {
  const { ideaId } = await params;
  await db.delete(ideas).where(eq(ideas.id, ideaId)).run();
  return NextResponse.json({ success: true });
}
