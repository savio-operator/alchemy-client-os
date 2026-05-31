import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  // Finance data is shared across all founders
  const rows = month
    ? await db.select().from(financeEntries).where(eq(financeEntries.month, month)).orderBy(desc(financeEntries.date)).all()
    : await db.select().from(financeEntries).orderBy(desc(financeEntries.date)).all();

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const body = await request.json();
  const entries = Array.isArray(body) ? body : [body];
  const now = new Date().toISOString();
  const created = [];

  for (const entry of entries) {
    if (!entry.description || !entry.amount || !entry.date || !entry.type) continue;

    const month = entry.month || entry.date.slice(0, 7);

    const record = {
      id: crypto.randomUUID(),
      userId: user.id,
      date: entry.date,
      type: entry.type,
      description: entry.description,
      category: entry.category || null,
      amount: parseFloat(entry.amount),
      client: entry.client || null,
      month,
      notes: entry.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(financeEntries).values(record).run();
    created.push(record);
  }

  return NextResponse.json(created, { status: 201 });
}
