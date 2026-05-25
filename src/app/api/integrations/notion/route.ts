import { NextResponse } from "next/server";
import {
  isNotionConfigured,
  searchNotion,
  createPage,
} from "@/lib/integrations/notion";

export async function GET(request: Request) {
  if (!isNotionConfigured()) {
    return NextResponse.json(
      { error: "Notion integration is not configured. Set NOTION_API_KEY." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  try {
    if (query) {
      const results = await searchNotion(query);
      return NextResponse.json(results);
    }

    // Default: return recent pages via empty search
    const results = await searchNotion("");
    return NextResponse.json(results);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Notion request failed";
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
    const { parentId, title, content } = body;

    if (!parentId || !title) {
      return NextResponse.json(
        { error: "parentId and title are required" },
        { status: 400 }
      );
    }

    const properties = {
      title: {
        title: [{ text: { content: title } }],
      },
    };

    const children: object[] | undefined = content
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content } }],
            },
          },
        ]
      : undefined;

    const page = await createPage(parentId, properties, children);
    return NextResponse.json(page);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Notion request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
