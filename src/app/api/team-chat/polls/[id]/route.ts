import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { chatPolls, chatPollVotes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pollId } = await params;

  const poll = await db.select().from(chatPolls).where(eq(chatPolls.id, pollId)).get();
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const votes = await db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, pollId)).all();

  const options: string[] = JSON.parse(poll.options);
  const voteCounts = options.map((_, i) => votes.filter((v) => v.optionIndex === i).length);
  const myVote = votes.find((v) => v.userId === user.id)?.optionIndex ?? null;

  return NextResponse.json({
    id: poll.id,
    channelId: poll.channelId,
    messageId: poll.messageId,
    question: poll.question,
    options,
    voteCounts,
    totalVotes: votes.length,
    myVote,
    createdAt: poll.createdAt,
  });
}
