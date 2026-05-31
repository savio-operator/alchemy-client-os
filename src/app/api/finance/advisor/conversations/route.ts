import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeConversations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const rows = await db
    .select()
    .from(financeConversations)
    .where(eq(financeConversations.userId, user.id))
    .orderBy(desc(financeConversations.updatedAt))
    .all();

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { title } = await request.json();
  const now = new Date().toISOString();
  const conv = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: title || "New conversation",
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(financeConversations).values(conv).run();
  return NextResponse.json(conv, { status: 201 });
}
