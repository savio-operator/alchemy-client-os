import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { tasks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const assignedTo = searchParams.get("assignedTo");
  const clientId = searchParams.get("clientId");

  const conditions = [];
  if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
  if (clientId) conditions.push(eq(tasks.clientId, clientId));

  const rows =
    conditions.length > 0
      ? await db.select().from(tasks).where(and(...conditions)).all()
      : await db.select().from(tasks).all();

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { title, clientId, priority, dueDate, description, assignedTo } = body;

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
    assignedTo: assignedTo || null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tasks).values(task).run();

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { id, status, priority, dueDate, assignedTo, description, title } = body;

  if (!id) return NextResponse.json({ error: "Task id is required" }, { status: 400 });

  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPrivileged = user.role === "founder" || user.role === "manager";
  const isAssigned = existing.assignedTo === user.id;

  // Non-privileged can only update status on their own tasks
  if (!isPrivileged && !isAssigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isPrivileged && assignedTo !== undefined) {
    return NextResponse.json({ error: "Only founders/managers can reassign tasks" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const updates: Partial<typeof existing> = { updatedAt: now };

  if (status !== undefined) {
    updates.status = status;
    if (status === "done" && !existing.completedAt) updates.completedAt = now;
    if (status !== "done") updates.completedAt = null;
  }
  if (isPrivileged) {
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (description !== undefined) updates.description = description;
    if (title !== undefined) updates.title = title;
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, id)).run();

  const updated = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  return NextResponse.json(updated);
}
