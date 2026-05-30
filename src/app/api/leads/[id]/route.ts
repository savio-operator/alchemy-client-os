import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { leads, clients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initPromise;

  const { id } = await params;

  const existing = await db.select().from(leads).where(eq(leads.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.delete(leads).where(eq(leads.id, id)).run();

  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder") {
    return NextResponse.json({ error: "Forbidden: only founder can convert leads" }, { status: 403 });
  }

  await initPromise;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (body.action !== "convert") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const lead = await db.select().from(leads).where(eq(leads.id, id)).get();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const clientName = lead.company || lead.name;
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const now = new Date().toISOString();
  const newClient = {
    id: crypto.randomUUID(),
    name: clientName,
    slug,
    industry: null,
    stage: null,
    createdAt: now,
    archivedAt: null,
  };

  await db.insert(clients).values(newClient).run();

  // Update lead status to won
  await db
    .update(leads)
    .set({ status: "won", updatedAt: now })
    .where(eq(leads.id, id))
    .run();

  return NextResponse.json(newClient, { status: 201 });
}
