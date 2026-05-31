"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  fixedCosts: number;
  net: number;
  entries: number;
}

export default function YearlyPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/summary?year=${year}`)
      .then((r) => r.json())
      .then((data) => {
        setMonths(data.months || []);
        setCurrency(data.currency || "INR");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--ink-muted)]">Loading...</div></div>;
  }

  let running = 0;
  const withBalance = months.map((m) => {
    running += m.net;
    return { ...m, balance: running };
  });

  const monthsWithData = months.filter((m) => m.entries > 0);
  const avgIncome = monthsWithData.length > 0 ? monthsWithData.reduce((s, m) => s + m.income, 0) / monthsWithData.length : 0;
  const avgExpenses = monthsWithData.length > 0 ? monthsWithData.reduce((s, m) => s + m.expenses, 0) / monthsWithData.length : 0;
  const avgFixed = monthsWithData.length > 0 ? monthsWithData.reduce((s, m) => s + m.fixedCosts, 0) / monthsWithData.length : 0;
  const avgNet = avgIncome - avgExpenses - avgFixed;
  const monthsRemaining = 12 - monthsWithData.length;
  const projectedYearEnd = running + avgNet * monthsRemaining;

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalFixed = months.reduce((s, m) => s + m.fixedCosts, 0);
  const totalNet = months.reduce((s, m) => s + m.net, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Year Overview</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">Full year financial summary and projections</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(year - 1)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--rule)] hover:bg-[var(--muted)]">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-lg font-bold w-14 text-center">{year}</span>
          <button onClick={() => setYear(year + 1)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--rule)] hover:bg-[var(--muted)]">
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Months Logged</p>
          <p className="text-xl font-bold mt-0.5">{monthsWithData.length} / 12</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Avg Monthly Net</p>
          <p className={`text-xl font-bold mt-0.5 ${avgNet >= 0 ? "text-green-600" : "text-red-600"}`}>
            {currency} {avgNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Current Balance</p>
          <p className={`text-xl font-bold mt-0.5 ${running >= 0 ? "text-green-600" : "text-red-600"}`}>
            {currency} {running.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--accent-clay)]/30 bg-[var(--accent-clay)]/5 p-3">
          <p className="text-xs text-[var(--accent-clay)]">Projected Year-End</p>
          <p className={`text-xl font-bold mt-0.5 ${projectedYearEnd >= 0 ? "text-green-600" : "text-red-600"}`}>
            {currency} {projectedYearEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">Based on {monthsWithData.length} month avg</p>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="mt-6 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--muted)]">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Month</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Income</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Var. Expenses</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Fixed Costs</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Net</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Running</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.map((m, i) => {
                const hasData = m.entries > 0;
                return (
                  <tr key={m.month} className={`border-b border-[var(--rule)] ${hasData ? "hover:bg-[var(--muted)]" : "opacity-40"} transition-colors`}>
                    <td className="px-3 py-2.5 text-sm font-medium">{MONTH_NAMES[i]}</td>
                    <td className="px-3 py-2.5 text-sm text-right text-green-600">{hasData ? `${currency} ${m.income.toLocaleString()}` : "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-right text-red-600">{hasData ? `${currency} ${m.expenses.toLocaleString()}` : "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-right text-orange-600">{currency} {m.fixedCosts.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-sm text-right font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {hasData ? `${currency} ${m.net.toLocaleString()}` : "-"}
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-right font-bold ${m.balance >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {hasData ? `${currency} ${m.balance.toLocaleString()}` : "-"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--muted)] font-bold">
                <td className="px-3 py-2.5 text-sm">Total</td>
                <td className="px-3 py-2.5 text-sm text-right text-green-700">{currency} {totalIncome.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-sm text-right text-red-700">{currency} {totalExpenses.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-sm text-right text-orange-700">{currency} {totalFixed.toLocaleString()}</td>
                <td className={`px-3 py-2.5 text-sm text-right ${totalNet >= 0 ? "text-green-700" : "text-red-700"}`}>{currency} {totalNet.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-sm text-right">{currency} {running.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
