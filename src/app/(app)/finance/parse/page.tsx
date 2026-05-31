"use client";

import { useState } from "react";
import { Sparkles, X, Check } from "lucide-react";

interface ParsedEntry {
  date: string;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  client: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ParsePage() {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth());
  const [error, setError] = useState("");

  const year = new Date().getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setError("");
    setEntries([]);
    setSaved(false);

    try {
      const res = await fetch("/api/finance/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (data.entries?.length > 0) {
        setEntries(data.entries);
      } else {
        setError("No financial entries could be extracted. Try pasting text with dates, amounts, and descriptions.");
      }
    } catch {
      setError("Failed to parse text.");
    }

    setParsing(false);
  };

  const handleSave = async () => {
    if (entries.length === 0) return;
    await fetch("/api/finance/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        entries.map((e) => ({ ...e, month: targetMonth }))
      ),
    });
    setSaved(true);
  };

  const removeEntry = (index: number) => setEntries(entries.filter((_, i) => i !== index));

  const updateEntry = (index: number, field: keyof ParsedEntry, value: string | number) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-serif font-semibold">Paste & Parse</h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1">Paste bank messages, invoices, or notes — AI extracts structured entries</p>

      <div className="mt-6 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
        <label className="block text-sm font-medium mb-2">Paste your text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste bank SMS, transaction emails, invoice notes, or any text containing financial data..."
          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-3 py-2.5 bg-transparent outline-none focus:border-[var(--accent-clay)] resize-none"
        />
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] text-white hover:bg-[var(--accent-clay)]/90 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
            {parsing ? "Parsing..." : "Parse with AI"}
          </button>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--ink-muted)]">Save to:</label>
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2 py-1 bg-transparent outline-none"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[parseInt(m.split("-")[1]) - 1]} {m.split("-")[0]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {entries.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Extracted Entries ({entries.length})</h2>
            <div className="flex items-center gap-3">
              {saved && <span className="text-green-600 text-xs font-medium flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={2} /> Saved!</span>}
              <button
                onClick={handleSave}
                disabled={saved}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saved ? "Saved!" : "Save All"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
                <div className="flex items-start gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                    <div>
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Date</label>
                      <input type="date" value={entry.date} onChange={(e) => updateEntry(i, "date", e.target.value)}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Type</label>
                      <select value={entry.type} onChange={(e) => updateEntry(i, "type", e.target.value)}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5">
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Amount</label>
                      <input type="number" value={entry.amount} onChange={(e) => updateEntry(i, "amount", Number(e.target.value))}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Description</label>
                      <input type="text" value={entry.description} onChange={(e) => updateEntry(i, "description", e.target.value)}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Category</label>
                      <input type="text" value={entry.category} onChange={(e) => updateEntry(i, "category", e.target.value)}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5" />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className="text-[10px] text-[var(--ink-muted)] uppercase">Client</label>
                      <input type="text" value={entry.client} onChange={(e) => updateEntry(i, "client", e.target.value)}
                        className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none mt-0.5" />
                    </div>
                  </div>
                  <button onClick={() => removeEntry(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
