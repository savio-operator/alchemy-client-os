import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { leads } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { name, company, email, phone, source } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const lead = {
    id: crypto.randomUUID(),
    name: name.trim(),
    company: company || null,
    email: email || null,
    phone: phone || null,
    source: source || null,
    status: "new",
    notes: null,
    assignedTo: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(leads).values(lead).run();

  return NextResponse.json(lead, { status: 201 });
}
