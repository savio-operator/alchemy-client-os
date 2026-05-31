import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { monthlyFixedCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (month) {
    // Shared data — find by month only
    const row = await db
      .select()
      .from(monthlyFixedCosts)
      .where(eq(monthlyFixedCosts.month, month))
      .get();

    if (!row) return NextResponse.json(null);
    return NextResponse.json({
      ...row,
      salaries: JSON.parse(row.salaries || "[]"),
      recurringExpenses: JSON.parse(row.recurringExpenses || "[]"),
    });
  }

  const rows = await db.select().from(monthlyFixedCosts).all();

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      salaries: JSON.parse(r.salaries || "[]"),
      recurringExpenses: JSON.parse(r.recurringExpenses || "[]"),
    }))
  );
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const body = await request.json();
  const { month, salaries, recurringExpenses } = body;
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const now = new Date().toISOString();
  // Shared data — find by month only
  const existing = await db
    .select()
    .from(monthlyFixedCosts)
    .where(eq(monthlyFixedCosts.month, month))
    .get();

  const data = {
    salaries: JSON.stringify(salaries || []),
    recurringExpenses: JSON.stringify(recurringExpenses || []),
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(monthlyFixedCosts)
      .set(data)
      .where(eq(monthlyFixedCosts.id, existing.id))
      .run();
  } else {
    await db.insert(monthlyFixedCosts).values({
      id: crypto.randomUUID(),
      userId: user.id,
      month,
      ...data,
      createdAt: now,
    }).run();
  }

  return NextResponse.json({ ok: true });
}
