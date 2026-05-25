import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientDiscoveries, discoveries } from "@/db/schema";
import { gte, isNull, and, desc, eq } from "drizzle-orm";

export async function GET() {
  // Get all unsurfaced discoveries with score >= 7
  const results = await db
    .select({
      cd: clientDiscoveries,
      d: discoveries,
    })
    .from(clientDiscoveries)
    .innerJoin(discoveries, eq(clientDiscoveries.discoveryId, discoveries.id))
    .where(
      and(
        gte(clientDiscoveries.score, 7),
        isNull(clientDiscoveries.surfacedAt),
        isNull(clientDiscoveries.dismissedAt)
      )
    )
    .orderBy(desc(clientDiscoveries.score))
    .limit(50)
    .all();

  return NextResponse.json({
    count: results.length,
    items: results.map((r) => ({
      ...r.cd,
      discovery: r.d,
    })),
  });
}
