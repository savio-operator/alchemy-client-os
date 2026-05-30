import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { ideas } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { clientId, title, body: ideaBody, column, tags } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const idea = {
    id: crypto.randomUUID(),
    clientId,
    title: title.trim(),
    body: ideaBody || null,
    column: column || "raw",
    tags: tags ? JSON.stringify(tags) : null,
    isOnline: true,
    estimatedCost: null,
    refinedBody: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(ideas).values(idea).run();

  return NextResponse.json(idea, { status: 201 });
}
