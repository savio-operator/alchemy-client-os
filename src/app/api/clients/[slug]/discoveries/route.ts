import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientDiscoveries, discoveries } from "@/db/schema";
import { eq, desc, and, gte, isNull } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = db.select().from(clients).where(eq(clients.slug, slug)).get();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const minScore = parseFloat(url.searchParams.get("minScore") || "0");
  const showDismissed = url.searchParams.get("dismissed") === "true";

  const results = db
    .select({
      cd: clientDiscoveries,
      d: discoveries,
    })
    .from(clientDiscoveries)
    .innerJoin(discoveries, eq(clientDiscoveries.discoveryId, discoveries.id))
    .where(
      and(
        eq(clientDiscoveries.clientId, client.id),
        gte(clientDiscoveries.score, minScore),
        ...(showDismissed ? [] : [isNull(clientDiscoveries.dismissedAt)])
      )
    )
    .orderBy(desc(clientDiscoveries.score))
    .limit(100)
    .all();

  return NextResponse.json(
    results.map((r) => ({
      ...r.cd,
      discovery: r.d,
    }))
  );
}
