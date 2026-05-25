import { NextResponse } from "next/server";
import { isNotionConfigured, getFinanceSummary } from "@/lib/integrations/notion";

export async function GET() {
  if (!isNotionConfigured()) {
    return NextResponse.json(
      { error: "Notion integration is not configured. Set NOTION_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const summary = await getFinanceSummary();
    return NextResponse.json(summary);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch finance summary";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
