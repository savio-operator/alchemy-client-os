import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientDiscoveries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; discoveryId: string }> }
) {
  const { discoveryId } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.dismiss) updateData.dismissedAt = new Date().toISOString();
  if (body.save) updateData.savedAt = new Date().toISOString();
  if (body.surface) updateData.surfacedAt = new Date().toISOString();

  if (Object.keys(updateData).length > 0) {
    db.update(clientDiscoveries)
      .set(updateData)
      .where(eq(clientDiscoveries.id, discoveryId))
      .run();
  }

  return NextResponse.json({ success: true });
}
