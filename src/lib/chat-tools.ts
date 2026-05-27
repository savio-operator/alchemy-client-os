import { db } from "@/db";
import { searchHistory } from "@/db";
import { ideas, memories, clients, clientBrief } from "@/db/schema";
import { getAuthedClient } from "@/lib/integrations/google";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface ToolDefinition {
  name: string;
  description: string;
  args: string;
}

const BASE_TOOLS: ToolDefinition[] = [
  {
    name: "calendar_list",
    description: "List upcoming Google Calendar events for the next 7 days",
    args: "none",
  },
  {
    name: "calendar_create",
    description: "Create a Google Calendar event",
    args: '{summary: string, start: "ISO datetime", end: "ISO datetime", description?: string}',
  },
  {
    name: "create_idea",
    description: "Add a new idea for a client",
    args: "{title: string, body?: string, clientSlug?: string}",
  },
  {
    name: "search_history",
    description: "Search client history entries",
    args: "{query: string}",
  },
  {
    name: "save_memory",
    description: "Save a key fact to long-term memory",
    args: "{fact: string}",
  },
];

const GLOBAL_TOOLS: ToolDefinition[] = [
  {
    name: "list_clients",
    description: "List all clients with their details",
    args: "none",
  },
  {
    name: "get_client_brief",
    description: "Get a specific client's brief and details",
    args: "{clientSlug: string}",
  },
];

export function buildToolsPrompt(isGlobal = false): string {
  const tools = isGlobal ? [...GLOBAL_TOOLS, ...BASE_TOOLS] : BASE_TOOLS;
  const toolLines = tools.map(
    (t) => `- ${t.name}: ${t.description}. Args: ${t.args}`
  ).join("\n");

  return `You have access to the following tools. To use a tool, include a JSON block in your response:
<tool_call>
{"tool": "tool_name", "args": {...}}
</tool_call>

Available tools:
${toolLines}

After a tool result is provided, continue your response to the user naturally. You can call multiple tools in one response. Only use tools when the user's request requires an action — do not use them for general conversation.`;
}

export function parseToolCalls(
  text: string
): Array<{ tool: string; args: Record<string, unknown> }> {
  const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, args: parsed.args || {} });
      }
    } catch {
      // skip malformed JSON
    }
  }
  return calls;
}

export function stripToolCalls(text: string): string {
  return text
    .replace(/<tool_call>\s*\{[\s\S]*?\}\s*<\/tool_call>/g, "")
    .trim();
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  clientId: string,
  conversationId: string
): Promise<string> {
  switch (toolName) {
    case "calendar_list": {
      try {
        const { google } = await import("googleapis");
        const authClient = await getAuthedClient();
        const calendar = google.calendar({ version: "v3", auth: authClient });
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: now.toISOString(),
          timeMax: nextWeek.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 20,
        });
        const events = (res.data.items || []).map((e) => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          location: e.location,
        }));
        return JSON.stringify(events);
      } catch (err) {
        return `Error listing calendar: ${err instanceof Error ? err.message : "Unknown error"}. Make sure Google OAuth is connected.`;
      }
    }

    case "calendar_create": {
      try {
        const { google } = await import("googleapis");
        const authClient = await getAuthedClient();
        const calendar = google.calendar({ version: "v3", auth: authClient });
        const event = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: args.summary as string,
            description: (args.description as string) || undefined,
            start: { dateTime: args.start as string },
            end: { dateTime: args.end as string },
          },
        });
        return `Created calendar event: "${event.data.summary}" on ${event.data.start?.dateTime}`;
      } catch (err) {
        return `Error creating event: ${err instanceof Error ? err.message : "Unknown error"}. Make sure Google OAuth is connected.`;
      }
    }

    case "create_idea": {
      // Resolve clientId from slug if in global mode
      let targetClientId = clientId;
      if (clientId === "global" && args.clientSlug) {
        const c = await db.select().from(clients).where(eq(clients.slug, args.clientSlug as string)).get();
        if (c) targetClientId = c.id;
        else return `Client "${args.clientSlug}" not found.`;
      }
      if (targetClientId === "global") return "Please specify a clientSlug for this idea.";

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(ideas)
        .values({
          id,
          clientId: targetClientId,
          title: args.title as string,
          body: (args.body as string) || null,
          column: "raw",
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return `Created idea: "${args.title}"`;
    }

    case "search_history": {
      const results = await searchHistory(
        args.query as string,
        clientId === "global" ? "" : clientId
      );
      if (results.length === 0) return "No history entries found.";
      return JSON.stringify(results.slice(0, 10));
    }

    case "save_memory": {
      const memId = crypto.randomUUID();
      await db
        .insert(memories)
        .values({
          id: memId,
          clientId: clientId === "global" ? "global" : clientId,
          fact: args.fact as string,
          sourceConversationId: conversationId,
          createdAt: new Date().toISOString(),
        })
        .run();
      return `Saved to memory: "${args.fact}"`;
    }

    case "list_clients": {
      const allClients = await db.select().from(clients).all();
      return JSON.stringify(allClients.map((c) => ({
        name: c.name,
        slug: c.slug,
        industry: c.industry,
        stage: c.stage,
      })));
    }

    case "get_client_brief": {
      const c = await db.select().from(clients).where(eq(clients.slug, args.clientSlug as string)).get();
      if (!c) return `Client "${args.clientSlug}" not found.`;
      const brief = await db.select().from(clientBrief).where(eq(clientBrief.clientId, c.id)).get();
      return JSON.stringify({ ...c, brief: brief || null });
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
