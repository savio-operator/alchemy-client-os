import { NextResponse } from "next/server";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await request.json();
  await db.update(campaigns)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(campaigns.id, campaignId))
    .run();
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; campaignId: string }> }
) {
  const { campaignId } = await params;
  await db.delete(campaigns).where(eq(campaigns.id, campaignId)).run();
  return NextResponse.json({ success: true });
}
