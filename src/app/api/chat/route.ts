import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  conversations,
  messages,
  memories,
  clients,
  clientBrief,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { callAIChat } from "@/lib/anthropic";
import {
  buildToolsPrompt,
  parseToolCalls,
  stripToolCalls,
  executeTool,
} from "@/lib/chat-tools";
import crypto from "crypto";

const MAX_TOOL_ITERATIONS = 3;

function buildSystemPrompt(
  clientName: string,
  brief: { summaryMd?: string | null; northStar?: string | null; audience?: string | null; voice?: string | null } | null,
  memoryFacts: string[]
): string {
  const parts = [
    `You are Adchemy AI, a smart assistant for the client "${clientName}". You help with strategy, scheduling, ideas, and analysis. Be concise and actionable. Never generate marketing copy — only analyze, score, and organize.`,
  ];

  if (brief?.summaryMd) {
    parts.push(`\n## Client Brief\n${brief.summaryMd}`);
    if (brief.northStar) parts.push(`North Star: ${brief.northStar}`);
    if (brief.audience) parts.push(`Audience: ${brief.audience}`);
    if (brief.voice) parts.push(`Voice: ${brief.voice}`);
  }

  if (memoryFacts.length > 0) {
    parts.push(
      `\n## Long-term Memory\n${memoryFacts.map((f) => `- ${f}`).join("\n")}`
    );
  }

  parts.push(`\n${buildToolsPrompt()}`);

  return parts.join("\n");
}

export async function POST(request: Request) {
  const body = await request.json();
  const { clientId, conversationId, message } = body as {
    clientId: string;
    conversationId?: string;
    message: string;
  };

  const now = new Date().toISOString();
  let convId = conversationId || "";

  // Create new conversation if needed
  if (!convId) {
    convId = crypto.randomUUID();
    const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
    await db
      .insert(conversations)
      .values({ id: convId, clientId, title, createdAt: now, updatedAt: now })
      .run();
  }

  // Save user message
  await db
    .insert(messages)
    .values({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: "user",
      content: message,
      createdAt: now,
    })
    .run();

  // Update conversation timestamp
  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, convId))
    .run();

  // Load context
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .get();
  const brief = await db
    .select()
    .from(clientBrief)
    .where(eq(clientBrief.clientId, clientId))
    .get();
  const clientMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.clientId, clientId))
    .all();

  const systemPrompt = buildSystemPrompt(
    client?.name || "Unknown",
    brief || null,
    clientMemories.map((m) => m.fact)
  );

  // Load conversation history (last 20 messages)
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(messages.createdAt)
    .all();

  const chatMessages = history.slice(-20).map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.role === "tool_result" ? `[Tool Result]: ${m.content}` : m.content,
  }));

  // Tool-calling loop
  let finalResponse = "";
  const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const aiResponse = await callAIChat(systemPrompt, chatMessages);
    const toolCalls = parseToolCalls(aiResponse);
    const textPart = stripToolCalls(aiResponse);

    if (toolCalls.length === 0) {
      finalResponse = textPart || aiResponse;
      break;
    }

    // Execute tools and collect results
    const toolResults: string[] = [];
    for (const tc of toolCalls) {
      const result = await executeTool(tc.tool, tc.args, clientId, convId);
      toolResults.push(`[${tc.tool}]: ${result}`);
      allToolCalls.push({ name: tc.tool, args: tc.args, result });
    }

    // Add AI response + tool results to conversation for next iteration
    if (textPart) {
      chatMessages.push({ role: "assistant", content: textPart });
    }
    chatMessages.push({
      role: "user",
      content: toolResults.join("\n"),
    });

    // If this is the last iteration, use whatever we have
    if (i === MAX_TOOL_ITERATIONS - 1) {
      finalResponse = textPart || "I executed the requested actions.";
    }
  }

  // Save assistant response
  await db
    .insert(messages)
    .values({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: "assistant",
      content: finalResponse,
      toolCalls: allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
      createdAt: new Date().toISOString(),
    })
    .run();

  // Save tool results as separate messages for history
  if (allToolCalls.length > 0) {
    await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "tool_result",
        content: allToolCalls.map((tc) => `[${tc.name}]: ${tc.result}`).join("\n"),
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  return NextResponse.json({
    conversationId: convId,
    message: finalResponse,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  });
}
