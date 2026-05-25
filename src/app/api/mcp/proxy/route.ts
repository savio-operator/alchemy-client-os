import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MCPClient } from "@/lib/mcp-client";

const MCP_PREFIX = "mcp_connection_";

interface MCPConnection {
  name: string;
  url: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { connection, tool, arguments: toolArgs } = body as {
    connection: string;
    tool: string;
    arguments?: Record<string, unknown>;
  };

  if (!connection || !tool) {
    return NextResponse.json(
      { error: "connection and tool are required" },
      { status: 400 }
    );
  }

  // Look up the connection config
  const key = `${MCP_PREFIX}${connection}`;
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();

  if (!row) {
    return NextResponse.json(
      { error: `Connection "${connection}" not found` },
      { status: 404 }
    );
  }

  const config = JSON.parse(row.value) as MCPConnection;

  try {
    const client = new MCPClient();
    await client.connect(config.url, config.apiKey || undefined);
    const result = await client.callTool(tool, toolArgs || {});
    return NextResponse.json({ result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Proxy call failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
