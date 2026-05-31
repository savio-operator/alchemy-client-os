"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [downloading, setDownloading] = useState(false);

  const year = new Date().getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/finance/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Adchemy_Report_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate report");
    }
    setDownloading(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-serif font-semibold">Reports</h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1">Download financial reports</p>

      <div className="mt-6 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-green-600" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-semibold">Monthly Excel Report</h2>
            <p className="text-xs text-[var(--ink-muted)]">Summary, entries, income, and expense sheets</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--ink-muted)]">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[parseInt(m.split("-")[1]) - 1]} {m.split("-")[0]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            {downloading ? "Generating..." : "Download .xlsx"}
          </button>
        </div>
      </div>
    </div>
  );
}
