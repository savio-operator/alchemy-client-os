import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { chatPolls, chatPollVotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pollId } = await params;

  const poll = await db.select().from(chatPolls).where(eq(chatPolls.id, pollId)).get();
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const body = await request.json();
  const { optionIndex } = body as { optionIndex: number };

  const options: string[] = JSON.parse(poll.options);
  if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= options.length) {
    return NextResponse.json({ error: "Invalid optionIndex" }, { status: 400 });
  }

  // Upsert: remove existing vote then insert
  await db.delete(chatPollVotes).where(
    and(eq(chatPollVotes.pollId, pollId), eq(chatPollVotes.userId, user.id))
  ).run();

  await db.insert(chatPollVotes).values({
    id: crypto.randomUUID(),
    pollId,
    userId: user.id,
    optionIndex,
    createdAt: new Date().toISOString(),
  }).run();

  // Return updated vote counts
  const votes = await db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, pollId)).all();
  const voteCounts = options.map((_, i) => votes.filter((v) => v.optionIndex === i).length);

  return NextResponse.json({
    id: poll.id,
    question: poll.question,
    options,
    voteCounts,
    totalVotes: votes.length,
    myVote: optionIndex,
  });
}
