import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeEntries, financeSettings, monthlyFixedCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  // Finance settings and data are shared across all founders
  const settings = await db.select().from(financeSettings).get();

  const currency = settings?.currency || "INR";
  const expectedMonthlyIncome = settings?.expectedMonthlyIncome || 0;
  const defaultSalaries = JSON.parse(settings?.salaries || "[]") as { name: string; amount: number }[];
  const defaultRecurring = JSON.parse(settings?.recurringExpenses || "[]") as { name: string; amount: number }[];
  const defaultFixedCosts = defaultSalaries.reduce((s, x) => s + x.amount, 0) + defaultRecurring.reduce((s, x) => s + x.amount, 0);

  // All entries (not filtered by user)
  const entries = await db.select().from(financeEntries).all();
  const yearEntries = entries.filter((e) => e.month.startsWith(year));

  // All monthly fixed cost overrides
  const overrides = await db.select().from(monthlyFixedCosts).all();

  const overrideMap = new Map(
    overrides.map((o) => {
      const sal = JSON.parse(o.salaries || "[]") as { amount: number }[];
      const rec = JSON.parse(o.recurringExpenses || "[]") as { amount: number }[];
      return [o.month, sal.reduce((s, x) => s + x.amount, 0) + rec.reduce((s, x) => s + x.amount, 0)];
    })
  );

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    const monthEntries = yearEntries.filter((e) => e.month === m);
    const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expenses = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const fixedCosts = overrideMap.get(m) ?? defaultFixedCosts;
    return { month: m, income, expenses, fixedCosts, net: income - expenses - fixedCosts, entries: monthEntries.length };
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const current = months.find((m) => m.month === currentMonth);

  return NextResponse.json({
    currency,
    expectedMonthlyIncome,
    currentMonth: current || { month: currentMonth, income: 0, expenses: 0, fixedCosts: defaultFixedCosts, net: -defaultFixedCosts, entries: 0 },
    months,
    totalEntries: yearEntries.length,
  });
}
