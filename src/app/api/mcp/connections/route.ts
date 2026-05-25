import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq, like } from "drizzle-orm";

const MCP_PREFIX = "mcp_connection_";

interface MCPConnection {
  name: string;
  url: string;
  apiKey?: string;
}

export async function GET() {
  const rows = await db
    .select()
    .from(settings)
    .where(like(settings.key, `${MCP_PREFIX}%`))
    .all();

  const connections = rows.map((row) => {
    const parsed = JSON.parse(row.value) as MCPConnection;
    return {
      name: parsed.name,
      url: parsed.url,
      hasApiKey: !!parsed.apiKey,
    };
  });

  return NextResponse.json(connections);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, url, apiKey } = body as { name: string; url: string; apiKey?: string };

  if (!name || !url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  const key = `${MCP_PREFIX}${name}`;
  const value = JSON.stringify({ name, url, apiKey: apiKey || null } as MCPConnection);

  // Upsert: delete then insert (sqlite-friendly)
  await db.delete(settings).where(eq(settings.key, key)).run();
  await db.insert(settings).values({ key, value }).run();

  return NextResponse.json({ name, url, hasApiKey: !!apiKey }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "name query param is required" }, { status: 400 });
  }

  const key = `${MCP_PREFIX}${name}`;
  await db.delete(settings).where(eq(settings.key, key)).run();

  return NextResponse.json({ deleted: name });
}
