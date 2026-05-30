import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { leads } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = db.select().from(leads).orderBy(desc(leads.createdAt));

  if (status) {
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.status, status))
      .orderBy(desc(leads.createdAt))
      .all();
    return NextResponse.json(rows);
  }

  const rows = await query.all();
  return NextResponse.json(rows);
}

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

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { id, name, company, email, phone, source, status, notes, assignedTo } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Check if lead exists
  const existing = await db.select().from(leads).where(eq(leads.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Require founder/manager role for status changes
  if (status && status !== existing.status) {
    if (user.role !== "founder" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden: only founder/manager can change status" }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (company !== undefined) updates.company = company;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (source !== undefined) updates.source = source;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;

  await db.update(leads).set(updates).where(eq(leads.id, id)).run();

  const updated = await db.select().from(leads).where(eq(leads.id, id)).get();
  return NextResponse.json(updated);
}
