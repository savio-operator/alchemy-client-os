import { NextResponse } from "next/server";
import {
  listSearchConsoleSites,
  getSearchConsoleData,
  getSearchConsolePages,
} from "@/lib/integrations/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteUrl = url.searchParams.get("siteUrl");
  const action = url.searchParams.get("action") || "sites";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  try {
    if (action === "sites") {
      const sites = await listSearchConsoleSites();
      return NextResponse.json({ sites });
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "siteUrl required" },
        { status: 400 }
      );
    }

    if (action === "queries") {
      const data = await getSearchConsoleData(siteUrl, startDate, endDate);
      return NextResponse.json(data);
    }

    if (action === "pages") {
      const data = await getSearchConsolePages(siteUrl, startDate, endDate);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Search Console request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
