import { db } from "@/db";
import { searchHistory } from "@/db";
import { ideas, memories } from "@/db/schema";
import { getAuthedClient } from "@/lib/integrations/google";
import crypto from "crypto";

export interface ToolDefinition {
  name: string;
  description: string;
  args: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
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
    description: "Add a new idea for this client",
    args: "{title: string, body?: string}",
  },
  {
    name: "search_history",
    description: "Search client history entries",
    args: "{query: string}",
  },
  {
    name: "save_memory",
    description: "Save a key fact to long-term memory for this client",
    args: "{fact: string}",
  },
];

export function buildToolsPrompt(): string {
  const toolLines = TOOL_DEFINITIONS.map(
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
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(ideas)
        .values({
          id,
          clientId,
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
        clientId
      );
      if (results.length === 0) return "No history entries found.";
      return JSON.stringify(results.slice(0, 10));
    }

    case "save_memory": {
      const id = crypto.randomUUID();
      await db
        .insert(memories)
        .values({
          id,
          clientId,
          fact: args.fact as string,
          sourceConversationId: conversationId,
          createdAt: new Date().toISOString(),
        })
        .run();
      return `Saved to memory: "${args.fact}"`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
