import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { tasks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { title, clientId, priority, dueDate, description } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    title: title.trim(),
    clientId: clientId || null,
    priority: priority || "medium",
    dueDate: dueDate || null,
    description: description || null,
    status: "todo",
    assignedTo: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tasks).values(task).run();

  return NextResponse.json(task, { status: 201 });
}
