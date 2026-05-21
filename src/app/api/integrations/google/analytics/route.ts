import { NextResponse } from "next/server";
import {
  listGA4Properties,
  getGA4Report,
  getGA4TopPages,
  getGA4TrafficSources,
} from "@/lib/integrations/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  const action = url.searchParams.get("action") || "properties";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  try {
    if (action === "properties") {
      const properties = await listGA4Properties();
      return NextResponse.json({ properties });
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId required" },
        { status: 400 }
      );
    }

    if (action === "report") {
      const report = await getGA4Report(propertyId, startDate, endDate);
      return NextResponse.json(report);
    }

    if (action === "top-pages") {
      const pages = await getGA4TopPages(propertyId, startDate, endDate);
      return NextResponse.json({ pages });
    }

    if (action === "traffic-sources") {
      const sources = await getGA4TrafficSources(
        propertyId,
        startDate,
        endDate
      );
      return NextResponse.json({ sources });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Analytics request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
