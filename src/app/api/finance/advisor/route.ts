import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, initPromise } from "@/db";
import { financeEntries, financeSettings, monthlyFixedCosts, financeMessages, financeConversations, clients, invoices, leads } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { callAIChat } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { messages, conversationId } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    conversationId?: string;
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

  // Fetch OS data for cross-referencing
  const allClients = await db.select().from(clients).all();
  const allInvoices = await db.select().from(invoices).all();
  const allLeads = await db.select().from(leads).all();

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

## Clients
${allClients.map((c) => `- ${c.name} (${c.industry || "no industry"}, ${c.stage || "no stage"})${c.archivedAt ? " [ARCHIVED]" : ""}`).join("\n") || "No clients"}

## Invoices
${allInvoices.map((inv) => {
  const client = allClients.find((c) => c.id === inv.clientId);
  return `- #${inv.number}: ${currency} ${inv.amount} — ${inv.status} — ${client?.name || "Unknown client"} — Due: ${inv.dueDate || "N/A"}`;
}).join("\n") || "No invoices"}

## Leads
${allLeads.map((l) => `- ${l.name}${l.company ? ` (${l.company})` : ""} — ${l.status}`).join("\n") || "No leads"}

## Financial Data
${monthSummaries || "No data yet"}

You have access to all OS data including clients, invoices, and leads. You can help with:
- Can we pay salaries this month?
- Year-end projections
- Identifying risky months
- Cost-cutting suggestions
- What-if scenarios
- Monthly financial summaries
- Client revenue breakdown
- Invoice status and collections
- Lead pipeline value

Be specific with numbers and reference actual data. Format currency amounts clearly.`;

  // Save user message to DB
  const lastUserMsg = messages[messages.length - 1];
  if (conversationId && lastUserMsg?.role === "user") {
    await db.insert(financeMessages).values({
      id: crypto.randomUUID(),
      conversationId,
      role: "user",
      content: lastUserMsg.content,
      createdAt: new Date().toISOString(),
    });

    // Update conversation title from first message
    const conv = await db.select().from(financeConversations).where(eq(financeConversations.id, conversationId)).get();
    if (conv && (conv.title === "New conversation" || !conv.title) && messages.length === 1) {
      await db.update(financeConversations)
        .set({ title: lastUserMsg.content.slice(0, 50) })
        .where(eq(financeConversations.id, conversationId));
    }
  }

  const text = await callAIChat(systemPrompt, messages);

  // Save assistant response to DB
  if (conversationId) {
    await db.insert(financeMessages).values({
      id: crypto.randomUUID(),
      conversationId,
      role: "assistant",
      content: text,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ message: text });
}
