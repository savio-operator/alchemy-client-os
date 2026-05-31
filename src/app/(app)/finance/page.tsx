"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";

interface Summary {
  currency: string;
  expectedMonthlyIncome: number;
  currentMonth: {
    month: string;
    income: number;
    expenses: number;
    fixedCosts: number;
    net: number;
    entries: number;
  };
  months: {
    month: string;
    income: number;
    expenses: number;
    fixedCosts: number;
    net: number;
    entries: number;
  }[];
  totalEntries: number;
}

function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  const date = new Date(parseInt(y), parseInt(mo) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/summary")
      .then((r) => r.json())
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--ink-muted)] text-sm">Loading...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--ink-muted)]">Failed to load finance data.</p>
      </div>
    );
  }

  const { currency, expectedMonthlyIncome, currentMonth, months } = summary;
  const totalExpenses = currentMonth.expenses + currentMonth.fixedCosts;
  const monthsWithData = months.filter((m) => m.entries > 0);
  const totalYearIncome = months.reduce((s, m) => s + m.income, 0);
  const totalYearExpenses = months.reduce((s, m) => s + m.expenses + m.fixedCosts, 0);

  const isSetup = expectedMonthlyIncome > 0;

  return (
    <div>
      <h1 className="text-2xl font-serif font-semibold">Finance</h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1">Overview for {formatMonth(currentMonth.month)}</p>

      {!isSetup && (
        <div className="mt-4 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">Setup required</p>
          <p className="text-xs text-yellow-600 mt-1">Configure your expected income, salaries, and recurring expenses.</p>
          <Link href="/finance/setup" className="inline-block mt-2 text-xs font-medium text-yellow-700 hover:text-yellow-900 underline">
            Go to Setup
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard
          icon={Calendar}
          label="Current Month"
          value={formatMonth(currentMonth.month)}
          sub={`${currentMonth.entries} entries`}
        />
        <StatCard
          icon={TrendingUp}
          label="Income"
          value={`${currency} ${currentMonth.income.toLocaleString()}`}
          sub={`Expected: ${currency} ${expectedMonthlyIncome.toLocaleString()}`}
          accent={currentMonth.income >= expectedMonthlyIncome ? "green" : "amber"}
        />
        <StatCard
          icon={TrendingDown}
          label="Expenses"
          value={`${currency} ${totalExpenses.toLocaleString()}`}
          sub={`Fixed: ${currency} ${currentMonth.fixedCosts.toLocaleString()}`}
        />
        <StatCard
          icon={DollarSign}
          label="Net P&L"
          value={`${currency} ${currentMonth.net.toLocaleString()}`}
          sub="After all costs"
          accent={currentMonth.net >= 0 ? "green" : "red"}
        />
      </div>

      {/* Quick Actions + Year Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold">Quick Actions</h2>
          <div className="mt-3 space-y-2">
            <QuickLink href="/finance/entries" icon={FileText} label="Add Income/Expense" desc="Log a new financial entry" />
            <QuickLink href="/finance/parse" icon={MessageSquare} label="Paste & Parse" desc="Extract entries from text using AI" />
            <QuickLink href="/finance/advisor" icon={MessageSquare} label="Ask AI Advisor" desc="Get financial insights and projections" />
            <QuickLink href="/finance/yearly" icon={BarChart3} label="Year Overview" desc="See full year financial summary" />
            <QuickLink href="/finance/setup" icon={Settings} label="Settings" desc="Configure salaries, expenses, currency" />
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold">Year Summary</h2>
          <div className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--ink-muted)]">Months logged</span>
              <span className="font-medium">{monthsWithData.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-muted)]">Total Income</span>
              <span className="font-medium text-green-600">{currency} {totalYearIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-muted)]">Total Expenses</span>
              <span className="font-medium text-red-600">{currency} {totalYearExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--rule)] pt-2.5">
              <span className="text-[var(--ink-muted)]">Net</span>
              <span className={`font-bold ${totalYearIncome - totalYearExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                {currency} {(totalYearIncome - totalYearExpenses).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  const colorClass = accent === "green" ? "text-green-600" : accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-[var(--ink)]";
  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <p className="text-xs text-[var(--ink-muted)]">{label}</p>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-[var(--ink-muted)] mt-1">{sub}</p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, desc }: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--rule)] hover:bg-[var(--muted)] transition-colors group"
    >
      <Icon className="w-4 h-4 text-[var(--ink-muted)] group-hover:text-[var(--accent-clay)]" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--ink-muted)]">{desc}</p>
      </div>
    </Link>
  );
}
