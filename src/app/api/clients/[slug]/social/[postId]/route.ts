import { NextResponse } from "next/server";
import { db } from "@/db";
import { socialPosts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  const { postId } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.platform !== undefined) updateData.platform = body.platform;
  if (body.copy !== undefined) updateData.copy = body.copy;
  if (body.scheduledFor !== undefined) updateData.scheduledFor = body.scheduledFor;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.mediaUrls !== undefined) updateData.mediaUrls = JSON.stringify(body.mediaUrls);

  await db.update(socialPosts).set(updateData).where(eq(socialPosts.id, postId)).run();
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  const { postId } = await params;
  await db.delete(socialPosts).where(eq(socialPosts.id, postId)).run();
  return NextResponse.json({ success: true });
}
