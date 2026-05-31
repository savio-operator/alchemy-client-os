import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeEntries, financeSettings, monthlyFixedCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { callAIChat } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { messages } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  // Gather all financial data for context
  const settings = await db.select().from(financeSettings).where(eq(financeSettings.userId, user.id)).get();
  const entries = await db.select().from(financeEntries).where(eq(financeEntries.userId, user.id)).all();
  const overrides = await db.select().from(monthlyFixedCosts).where(eq(monthlyFixedCosts.userId, user.id)).all();

  const currency = settings?.currency || "INR";
  const expectedIncome = settings?.expectedMonthlyIncome || 0;
  const salaries = JSON.parse(settings?.salaries || "[]") as { name: string; amount: number }[];
  const recurring = JSON.parse(settings?.recurringExpenses || "[]") as { name: string; amount: number }[];
  const defaultFixedCosts = salaries.reduce((s, x) => s + x.amount, 0) + recurring.reduce((s, x) => s + x.amount, 0);

  const overrideMap = new Map(
    overrides.map((o) => {
      const sal = JSON.parse(o.salaries || "[]") as { amount: number }[];
      const rec = JSON.parse(o.recurringExpenses || "[]") as { amount: number }[];
      return [o.month, sal.reduce((s, x) => s + x.amount, 0) + rec.reduce((s, x) => s + x.amount, 0)];
    })
  );

  // Group entries by month
  const byMonth = new Map<string, typeof entries>();
  for (const entry of entries) {
    const arr = byMonth.get(entry.month) || [];
    arr.push(entry);
    byMonth.set(entry.month, arr);
  }

  const monthSummaries = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthEntries]) => {
      const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const expenses = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      const fixed = overrideMap.get(month) ?? defaultFixedCosts;
      const details = monthEntries.map((e) => `  - ${e.date} | ${e.type} | ${e.description} | ${e.category || ""} | ${currency} ${e.amount} | ${e.client || ""}`).join("\n");
      return `### ${month}\n- Income: ${currency} ${income}\n- Expenses: ${currency} ${expenses}\n- Fixed Costs: ${currency} ${fixed}\n- Net: ${currency} ${income - expenses - fixed}\n- Entries: ${monthEntries.length}\n${details}`;
    })
    .join("\n\n");

  const systemPrompt = `You are the AI financial advisor for Adchemy, a digital agency. You have access to all financial data and can provide insights, projections, and recommendations.

## Settings
- Expected Monthly Income: ${currency} ${expectedIncome}
- Currency: ${currency}
- Default Fixed Monthly Costs: ${currency} ${defaultFixedCosts}

### Salaries
${salaries.map((x) => `- ${x.name}: ${currency} ${x.amount}`).join("\n") || "None configured"}

### Recurring Expenses
${recurring.map((e) => `- ${e.name}: ${currency} ${e.amount}`).join("\n") || "None configured"}

## Financial Data
${monthSummaries || "No data yet"}

You can help with:
- Can we pay salaries this month?
- Year-end projections
- Identifying risky months
- Cost-cutting suggestions
- What-if scenarios
- Monthly financial summaries

Be specific with numbers and reference actual data. Format currency amounts clearly.`;

  const text = await callAIChat(systemPrompt, messages);
  return NextResponse.json({ message: text });
}
