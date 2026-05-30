import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { challenges } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const assignedBy = searchParams.get("assignedBy");

  const conditions = [];
  if (userId) conditions.push(eq(challenges.assignedTo, userId));
  if (assignedBy) conditions.push(eq(challenges.assignedBy, assignedBy));

  const rows =
    conditions.length > 0
      ? await db.select().from(challenges).where(and(...conditions)).all()
      : await db.select().from(challenges).all();

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Only founders/managers can create challenges" }, { status: 403 });
  }

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { title, description, assignedTo, reward, dueDate } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!assignedTo || typeof assignedTo !== "string") {
    return NextResponse.json({ error: "assignedTo is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const challenge = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description || null,
    assignedTo,
    assignedBy: user.id,
    status: "active",
    reward: reward || null,
    dueDate: dueDate || null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(challenges).values(challenge).run();

  return NextResponse.json(challenge, { status: 201 });
}
