import { NextResponse } from "next/server";
import {
  isNotionConfigured,
  getReportPage,
  appendBlockChildren,
} from "@/lib/integrations/notion";

export async function GET() {
  if (!isNotionConfigured()) {
    return NextResponse.json(
      { error: "Notion integration is not configured. Set NOTION_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const report = await getReportPage();
    return NextResponse.json(report);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch report page";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isNotionConfigured()) {
    return NextResponse.json(
      { error: "Notion integration is not configured. Set NOTION_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const pageId = process.env.NOTION_REPORT_PAGE_ID;
    if (!pageId) {
      return NextResponse.json(
        { error: "NOTION_REPORT_PAGE_ID is not configured" },
        { status: 503 }
      );
    }

    const children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content } }],
        },
      },
    ];

    const result = await appendBlockChildren(pageId, children);
    return NextResponse.json(result);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to append to report page";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
