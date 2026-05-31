import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  // Finance settings are shared — use the first (and only) row
  const row = await db.select().from(financeSettings).get();

  if (!row) {
    return NextResponse.json({
      currency: "INR",
      expectedMonthlyIncome: 0,
      salaries: [],
      recurringExpenses: [],
    });
  }

  return NextResponse.json({
    ...row,
    salaries: JSON.parse(row.salaries || "[]"),
    recurringExpenses: JSON.parse(row.recurringExpenses || "[]"),
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const body = await request.json();
  const now = new Date().toISOString();

  // Finance settings are shared — get the single row
  const existing = await db.select().from(financeSettings).get();

  const data = {
    currency: body.currency || "INR",
    expectedMonthlyIncome: body.expectedMonthlyIncome || 0,
    salaries: JSON.stringify(body.salaries || []),
    recurringExpenses: JSON.stringify(body.recurringExpenses || []),
    updatedAt: now,
  };

  if (existing) {
    await db.update(financeSettings).set(data).where(eq(financeSettings.id, existing.id)).run();
  } else {
    await db.insert(financeSettings).values({
      id: crypto.randomUUID(),
      userId: user.id,
      ...data,
      createdAt: now,
    }).run();
  }

  return NextResponse.json({ ok: true });
}
