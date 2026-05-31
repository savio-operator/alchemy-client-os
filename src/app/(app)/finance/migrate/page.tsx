"use client";

import { useState } from "react";
import { Upload, Check, AlertCircle } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function convertMonthKey(key: string): string {
  // Convert "May 2025" → "2025-05"
  const parts = key.split(" ");
  if (parts.length === 2) {
    const monthIdx = MONTHS.indexOf(parts[0]);
    if (monthIdx >= 0) {
      return `${parts[1]}-${String(monthIdx + 1).padStart(2, "0")}`;
    }
  }
  return key;
}

export default function MigratePage() {
  const [status, setStatus] = useState<"idle" | "migrating" | "done" | "error">("idle");
  const [details, setDetails] = useState<string[]>([]);

  const runMigration = async () => {
    setStatus("migrating");
    setDetails([]);
    const log = (msg: string) => setDetails((prev) => [...prev, msg]);

    try {
      // 1. Migrate settings
      const rawSettings = localStorage.getItem("adchemy_settings");
      if (rawSettings) {
        const settings = JSON.parse(rawSettings);
        await fetch("/api/finance/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        log(`Settings migrated (currency: ${settings.currency}, income target: ${settings.expectedMonthlyIncome})`);
      } else {
        log("No settings found in localStorage");
      }

      // 2. Migrate entries
      const rawEntries = localStorage.getItem("adchemy_entries");
      if (rawEntries) {
        const allEntries: Record<string, Array<{ date: string; type: string; description: string; category: string; amount: number; client: string }>> = JSON.parse(rawEntries);
        let totalEntries = 0;

        for (const [monthKey, entries] of Object.entries(allEntries)) {
          if (!entries || entries.length === 0) continue;
          const month = convertMonthKey(monthKey);

          const mapped = entries.map((e) => ({
            date: e.date,
            type: e.type,
            description: e.description,
            category: e.category,
            amount: e.amount,
            client: e.client,
            month,
          }));

          await fetch("/api/finance/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mapped),
          });

          totalEntries += entries.length;
          log(`${monthKey}: ${entries.length} entries migrated`);
        }

        log(`Total: ${totalEntries} entries migrated`);
      } else {
        log("No entries found in localStorage");
      }

      // 3. Migrate monthly fixed costs
      const rawCosts = localStorage.getItem("adchemy_monthly_fixed_costs");
      if (rawCosts) {
        const allCosts: Record<string, { salaries: Array<{ name: string; amount: number }>; recurringExpenses: Array<{ name: string; amount: number }> }> = JSON.parse(rawCosts);
        let costCount = 0;

        for (const [monthKey, costs] of Object.entries(allCosts)) {
          const month = convertMonthKey(monthKey);
          await fetch("/api/finance/fixed-costs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month, ...costs }),
          });
          costCount++;
        }

        log(`${costCount} monthly fixed cost overrides migrated`);
      } else {
        log("No monthly fixed costs found in localStorage");
      }

      setStatus("done");
      log("Migration complete!");
    } catch (err) {
      setStatus("error");
      log(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-serif font-semibold">Data Migration</h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1">
        Import data from the standalone Adchemy Finance app (localStorage)
      </p>

      <div className="mt-6 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <Upload className="w-5 h-5 text-[var(--ink-muted)] mt-0.5" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-semibold">Import from localStorage</h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              This will read <code className="px-1 py-0.5 bg-[var(--muted)] rounded text-[10px]">adchemy_entries</code>,{" "}
              <code className="px-1 py-0.5 bg-[var(--muted)] rounded text-[10px]">adchemy_settings</code>, and{" "}
              <code className="px-1 py-0.5 bg-[var(--muted)] rounded text-[10px]">adchemy_monthly_fixed_costs</code>{" "}
              from your browser and save them to the database.
            </p>
            <p className="text-xs text-orange-600 mt-2">
              Make sure you&apos;re running this in the same browser where you used the standalone finance app.
            </p>
          </div>
        </div>

        <button
          onClick={runMigration}
          disabled={status === "migrating"}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] text-white hover:bg-[var(--accent-clay)]/90 disabled:opacity-50 transition-colors"
        >
          {status === "migrating" ? "Migrating..." : status === "done" ? "Run Again" : "Start Migration"}
        </button>
      </div>

      {details.length > 0 && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 mb-3">
            {status === "done" ? (
              <Check className="w-4 h-4 text-green-600" strokeWidth={2} />
            ) : status === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-500" strokeWidth={2} />
            ) : null}
            <span className="text-sm font-medium">
              {status === "done" ? "Migration complete" : status === "error" ? "Migration failed" : "Migrating..."}
            </span>
          </div>
          <div className="space-y-1">
            {details.map((line, i) => (
              <p key={i} className="text-xs text-[var(--ink-muted)] font-mono">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
