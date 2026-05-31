import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { financeEntries, financeSettings, monthlyFixedCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initPromise;

  const { month } = await request.json();
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  // Get data
  const entries = await db
    .select()
    .from(financeEntries)
    .where(and(eq(financeEntries.userId, user.id), eq(financeEntries.month, month)))
    .all();

  const settings = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.userId, user.id))
    .get();

  const override = await db
    .select()
    .from(monthlyFixedCosts)
    .where(and(eq(monthlyFixedCosts.userId, user.id), eq(monthlyFixedCosts.month, month)))
    .get();

  const currency = settings?.currency || "INR";
  const defaultSalaries = JSON.parse(settings?.salaries || "[]") as { name: string; amount: number }[];
  const defaultRecurring = JSON.parse(settings?.recurringExpenses || "[]") as { name: string; amount: number }[];

  const costSalaries = override ? JSON.parse(override.salaries || "[]") as { name: string; amount: number }[] : defaultSalaries;
  const costRecurring = override ? JSON.parse(override.recurringExpenses || "[]") as { name: string; amount: number }[] : defaultRecurring;

  const salaryTotal = costSalaries.reduce((s, x) => s + x.amount, 0);
  const expenseTotal = costRecurring.reduce((s, x) => s + x.amount, 0);
  const fixedCosts = salaryTotal + expenseTotal;

  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const variableExpenses = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const net = income - variableExpenses - fixedCosts;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ["Adchemy Finance Report", ""],
    ["Month", month],
    ["Currency", currency],
    ["", ""],
    ["INCOME", ""],
    ["Total Income", income],
    ["", ""],
    ["VARIABLE EXPENSES", ""],
    ["Total Variable Expenses", variableExpenses],
    ["", ""],
    ["FIXED COSTS", ""],
    ...costSalaries.map((s) => [`Salary: ${s.name}`, s.amount]),
    ...costRecurring.map((e) => [`Recurring: ${e.name}`, e.amount]),
    ["Total Fixed Costs", fixedCosts],
    ["", ""],
    ["NET P&L", net],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Sheet 2: All Entries
  const entriesData = entries.map((e) => ({
    Date: e.date,
    Type: e.type,
    Description: e.description,
    Category: e.category || "",
    Amount: e.amount,
    Client: e.client || "",
  }));
  const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
  entriesSheet["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, entriesSheet, "Entries");

  // Sheet 3: Income
  const incomeEntries = entries.filter((e) => e.type === "income");
  if (incomeEntries.length > 0) {
    const incomeSheet = XLSX.utils.json_to_sheet(
      incomeEntries.map((e) => ({ Date: e.date, Description: e.description, Category: e.category || "", Amount: e.amount, Client: e.client || "" }))
    );
    XLSX.utils.book_append_sheet(wb, incomeSheet, "Income");
  }

  // Sheet 4: Expenses
  const expenseEntries = entries.filter((e) => e.type === "expense");
  if (expenseEntries.length > 0) {
    const expenseSheet = XLSX.utils.json_to_sheet(
      expenseEntries.map((e) => ({ Date: e.date, Description: e.description, Category: e.category || "", Amount: e.amount, Client: e.client || "" }))
    );
    XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `Adchemy_Report_${month}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
