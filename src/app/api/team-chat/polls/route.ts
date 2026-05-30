import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { chatPolls, chatMessages } from "@/db/schema";
import crypto from "crypto";

export async function POST(request: Request) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { channelId, question, options } = body as {
    channelId: string;
    question: string;
    options: string[];
  };

  if (!channelId || !question?.trim() || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "channelId, question, and at least 2 options required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const pollId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  // Post the message first (with [POLL:id] content)
  await db.insert(chatMessages).values({
    id: messageId,
    channelId,
    userId: user.id,
    content: `[POLL:${pollId}]`,
    createdAt: now,
  }).run();

  // Create the poll
  await db.insert(chatPolls).values({
    id: pollId,
    channelId,
    messageId,
    question: question.trim(),
    options: JSON.stringify(options.map((o) => o.trim()).filter(Boolean)),
    createdAt: now,
  }).run();

  return NextResponse.json({ id: pollId, messageId, channelId, question, options, createdAt: now });
}
