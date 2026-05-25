import { NextResponse } from "next/server";
import { db } from "@/db";
import { searchHistory } from "@/db";
import { clients, ideas, campaigns, agentRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callAI } from "@/lib/anthropic";
import { getAgent } from "@/lib/agents";

// MCP Server - JSON-RPC endpoint

const SERVER_INFO = {
  name: "adchemy-client-os",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: {},
};

const TOOLS = [
  {
    name: "list_clients",
    description: "List all clients in the system",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_client",
    description: "Get client details by slug",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Client slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "create_idea",
    description: "Create a new idea for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        title: { type: "string", description: "Idea title" },
        body: { type: "string", description: "Idea body/description" },
        column: { type: "string", description: "Column: raw, cooking, or ready", default: "raw" },
      },
      required: ["clientId", "title"],
    },
  },
  {
    name: "list_ideas",
    description: "List ideas for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "list_campaigns",
    description: "List campaigns for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "run_agent",
    description: "Trigger an AI agent with input text",
    inputSchema: {
      type: "object",
      properties: {
        agentName: { type: "string", description: "Name of the agent to run" },
        clientId: { type: "string", description: "Client ID for context" },
        input: { type: "string", description: "Input text for the agent" },
      },
      required: ["agentName", "clientId", "input"],
    },
  },
  {
    name: "search_history",
    description: "Search history entries for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        query: { type: "string", description: "Search query" },
      },
      required: ["clientId", "query"],
    },
  },
];

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", error: { code, message }, id };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", result, id };
}

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_clients": {
      const allClients = await db.select().from(clients).all();
      return { content: [{ type: "text", text: JSON.stringify(allClients) }] };
    }

    case "get_client": {
      const slug = args.slug as string;
      const client = await db.select().from(clients).where(eq(clients.slug, slug)).get();
      if (!client) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Client not found" }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(client) }] };
    }

    case "create_idea": {
      const id = globalThis.crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(ideas).values({
        id,
        clientId: args.clientId as string,
        title: args.title as string,
        body: (args.body as string) || null,
        column: (args.column as string) || "raw",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(ideas).where(eq(ideas.id, id)).get();
      return { content: [{ type: "text", text: JSON.stringify(created) }] };
    }

    case "list_ideas": {
      const clientIdeas = await db.select().from(ideas).where(eq(ideas.clientId, args.clientId as string)).all();
      return { content: [{ type: "text", text: JSON.stringify(clientIdeas) }] };
    }

    case "list_campaigns": {
      const clientCampaigns = await db.select().from(campaigns).where(eq(campaigns.clientId, args.clientId as string)).all();
      return { content: [{ type: "text", text: JSON.stringify(clientCampaigns) }] };
    }

    case "run_agent": {
      const agentName = args.agentName as string;
      const clientId = args.clientId as string;
      const input = args.input as string;

      const agent = getAgent(agentName);
      if (!agent) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Agent not found" }) }], isError: true };
      }

      const output = await callAI(agent.systemPrompt, input, { model: agent.model });
      const id = globalThis.crypto.randomUUID();
      await db.insert(agentRuns).values({
        id,
        clientId,
        agentName,
        inputJson: JSON.stringify({ input }),
        outputMd: output,
        createdAt: new Date().toISOString(),
      }).run();

      return { content: [{ type: "text", text: output }] };
    }

    case "search_history": {
      const results = await searchHistory(args.query as string, args.clientId as string);
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(request: Request) {
  let body: { jsonrpc: string; method: string; params?: Record<string, unknown>; id?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, "Parse error"));
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return NextResponse.json(jsonRpcError(body.id ?? null, -32600, "Invalid Request"));
  }

  const { method, params, id } = body;

  try {
    switch (method) {
      case "initialize": {
        return NextResponse.json(
          jsonRpcResult(id, {
            protocolVersion: "2024-11-05",
            serverInfo: SERVER_INFO,
            capabilities: CAPABILITIES,
          })
        );
      }

      case "tools/list": {
        return NextResponse.json(jsonRpcResult(id, { tools: TOOLS }));
      }

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolArgs = ((params as { arguments?: Record<string, unknown> }).arguments) || {};
        const result = await handleToolCall(toolName, toolArgs);
        return NextResponse.json(jsonRpcResult(id, result));
      }

      default:
        return NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(jsonRpcError(id, -32603, msg));
  }
}
