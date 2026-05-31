"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Download, Pencil, Trash2 } from "lucide-react";

interface Entry {
  id: string;
  date: string;
  type: "income" | "expense";
  description: string;
  category: string | null;
  amount: number;
  client: string | null;
  month: string;
}

interface FixedCostItem {
  name: string;
  amount: number;
}

interface Settings {
  currency: string;
  expectedMonthlyIncome: number;
  salaries: FixedCostItem[];
  recurringExpenses: FixedCostItem[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const date = new Date(parseInt(y), parseInt(mo) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function EntriesPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fixedCosts, setFixedCosts] = useState<{ salaries: FixedCostItem[]; recurringExpenses: FixedCostItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFixedCosts, setShowFixedCosts] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "income" as "income" | "expense",
    description: "",
    category: "",
    amount: "",
    client: "",
  });

  const [editFixedCosts, setEditFixedCosts] = useState<{
    salaries: FixedCostItem[];
    recurringExpenses: FixedCostItem[];
  }>({ salaries: [], recurringExpenses: [] });

  const loadData = useCallback(async (month: string) => {
    setLoading(true);
    const [entriesRes, settingsRes, fixedRes] = await Promise.all([
      fetch(`/api/finance/entries?month=${month}`),
      fetch("/api/finance/settings"),
      fetch(`/api/finance/fixed-costs?month=${month}`),
    ]);
    const entriesData = await entriesRes.json();
    const settingsData = await settingsRes.json();
    const fixedData = await fixedRes.json();

    setEntries(entriesData);
    setSettings(settingsData);

    const costs = fixedData || {
      salaries: settingsData.salaries || [],
      recurringExpenses: settingsData.recurringExpenses || [],
    };
    setFixedCosts(costs);
    setEditFixedCosts({
      salaries: costs.salaries.map((s: FixedCostItem) => ({ ...s })),
      recurringExpenses: costs.recurringExpenses.map((e: FixedCostItem) => ({ ...e })),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth, loadData]);

  const handleAdd = async () => {
    if (!form.description || !form.amount) return;
    await fetch("/api/finance/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), month: selectedMonth }),
    });
    setForm({ date: new Date().toISOString().split("T")[0], type: "income", description: "", category: "", amount: "", client: "" });
    setShowForm(false);
    loadData(selectedMonth);
  };

  const handleEdit = (entry: Entry) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      type: entry.type,
      description: entry.description,
      category: entry.category || "",
      amount: String(entry.amount),
      client: entry.client || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingId || !form.description || !form.amount) return;
    await fetch(`/api/finance/entries/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setEditingId(null);
    setForm({ date: new Date().toISOString().split("T")[0], type: "income", description: "", category: "", amount: "", client: "" });
    loadData(selectedMonth);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/finance/entries/${id}`, { method: "DELETE" });
    setEditingId(null);
    loadData(selectedMonth);
  };

  const handleSaveFixedCosts = async () => {
    await fetch("/api/finance/fixed-costs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: selectedMonth, ...editFixedCosts }),
    });
    setShowFixedCosts(false);
    loadData(selectedMonth);
  };

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

  const currency = settings?.currency || "INR";
  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const fixed = fixedCosts
    ? fixedCosts.salaries.reduce((s, x) => s + x.amount, 0) + fixedCosts.recurringExpenses.reduce((s, x) => s + x.amount, 0)
    : 0;
  const net = income - expenses - fixed;

  const year = new Date().getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Entries</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">{formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading || entries.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--ink)] transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">{downloading ? "Generating..." : "Report"}</span>
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] text-white hover:bg-[var(--accent-clay)]/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex gap-1.5 mt-4 overflow-x-auto scrollbar-none pb-1">
        {monthOptions.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium whitespace-nowrap transition-colors ${
              selectedMonth === m
                ? "bg-[var(--accent-clay)] text-white"
                : "border border-[var(--rule)] text-[var(--ink-muted)] hover:bg-[var(--muted)]"
            }`}
          >
            {MONTH_NAMES[parseInt(m.split("-")[1]) - 1]}
          </button>
        ))}
      </div>

      {/* Add Entry Form */}
      {showForm && !editingId && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--accent-clay)]/30 bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">New entry for {formatMonthLabel(selectedMonth)}</span>
            <button onClick={() => setShowForm(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)]">
              <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Amount</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this for?" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Client Payment" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Client</label>
              <input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Optional" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleAdd} className="h-8 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] text-white hover:bg-[var(--accent-clay)]/90">Save</button>
            <button onClick={() => setShowForm(false)} className="h-8 px-3 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Income</p>
          <p className="text-lg font-bold text-green-600 mt-0.5">{currency} {income.toLocaleString()}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Variable Expenses</p>
          <p className="text-lg font-bold text-red-600 mt-0.5">{currency} {expenses.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowFixedCosts(!showFixedCosts)} className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3 text-left hover:border-orange-300 transition-colors">
          <p className="text-xs text-[var(--ink-muted)]">Fixed Costs <span className="text-orange-400">(edit)</span></p>
          <p className="text-lg font-bold text-orange-600 mt-0.5">{currency} {fixed.toLocaleString()}</p>
        </button>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">Net P&L</p>
          <p className={`text-lg font-bold mt-0.5 ${net >= 0 ? "text-green-600" : "text-red-600"}`}>{currency} {net.toLocaleString()}</p>
        </div>
      </div>

      {/* Fixed Costs Editor */}
      {showFixedCosts && (
        <div className="mt-4 rounded-[var(--radius)] border border-orange-200 bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium">Fixed Costs for {formatMonthLabel(selectedMonth)}</span>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">Specific to this month only.</p>
            </div>
            <button onClick={() => {
              if (settings) {
                setEditFixedCosts({
                  salaries: settings.salaries.map((s) => ({ ...s })),
                  recurringExpenses: settings.recurringExpenses.map((e) => ({ ...e })),
                });
              }
            }} className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--rule)] rounded px-2 py-1">
              Reset to Default
            </button>
          </div>

          {/* Salaries */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-[var(--ink-muted)] uppercase">Salaries</p>
              <button onClick={() => setEditFixedCosts({ ...editFixedCosts, salaries: [...editFixedCosts.salaries, { name: "", amount: 0 }] })}
                className="text-xs text-[var(--accent-clay)] hover:underline">+ Add</button>
            </div>
            {editFixedCosts.salaries.map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <input type="text" value={s.name} onChange={(e) => {
                  const updated = [...editFixedCosts.salaries];
                  updated[i] = { ...updated[i], name: e.target.value };
                  setEditFixedCosts({ ...editFixedCosts, salaries: updated });
                }} placeholder="Name" className="flex-1 text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" />
                <input type="number" value={s.amount || ""} onChange={(e) => {
                  const updated = [...editFixedCosts.salaries];
                  updated[i] = { ...updated[i], amount: Number(e.target.value) };
                  setEditFixedCosts({ ...editFixedCosts, salaries: updated });
                }} placeholder="Amount" className="w-24 text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" />
                <button onClick={() => setEditFixedCosts({ ...editFixedCosts, salaries: editFixedCosts.salaries.filter((_, idx) => idx !== i) })}
                  className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" strokeWidth={2} /></button>
              </div>
            ))}
          </div>

          {/* Recurring */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-[var(--ink-muted)] uppercase">Recurring Expenses</p>
              <button onClick={() => setEditFixedCosts({ ...editFixedCosts, recurringExpenses: [...editFixedCosts.recurringExpenses, { name: "", amount: 0 }] })}
                className="text-xs text-[var(--accent-clay)] hover:underline">+ Add</button>
            </div>
            {editFixedCosts.recurringExpenses.map((e, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <input type="text" value={e.name} onChange={(ev) => {
                  const updated = [...editFixedCosts.recurringExpenses];
                  updated[i] = { ...updated[i], name: ev.target.value };
                  setEditFixedCosts({ ...editFixedCosts, recurringExpenses: updated });
                }} placeholder="Name" className="flex-1 text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" />
                <input type="number" value={e.amount || ""} onChange={(ev) => {
                  const updated = [...editFixedCosts.recurringExpenses];
                  updated[i] = { ...updated[i], amount: Number(ev.target.value) };
                  setEditFixedCosts({ ...editFixedCosts, recurringExpenses: updated });
                }} placeholder="Amount" className="w-24 text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" />
                <button onClick={() => setEditFixedCosts({ ...editFixedCosts, recurringExpenses: editFixedCosts.recurringExpenses.filter((_, idx) => idx !== i) })}
                  className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" strokeWidth={2} /></button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--rule)]">
            <p className="text-sm font-medium">Total: {currency} {(editFixedCosts.salaries.reduce((s, x) => s + x.amount, 0) + editFixedCosts.recurringExpenses.reduce((s, x) => s + x.amount, 0)).toLocaleString()}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowFixedCosts(false)} className="h-7 px-3 text-xs text-[var(--ink-muted)]">Cancel</button>
              <button onClick={handleSaveFixedCosts} className="h-7 px-3 rounded text-xs font-medium bg-orange-600 text-white hover:bg-orange-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <div className="mt-4 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--muted)]">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Date</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Type</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Description</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Category</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Amount</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase">Client</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--ink-muted)] uppercase w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--ink-muted)]">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--ink-muted)]">No entries for {formatMonthLabel(selectedMonth)}</td></tr>
              ) : (
                entries.map((entry) =>
                  editingId === entry.id ? (
                    <tr key={entry.id} className="border-b border-[var(--rule)] bg-[var(--accent-clay)]/5">
                      <td className="px-3 py-2"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" /></td>
                      <td className="px-3 py-2">
                        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none">
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" /></td>
                      <td className="px-3 py-2"><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" /></td>
                      <td className="px-3 py-2"><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none text-right" /></td>
                      <td className="px-3 py-2"><input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded px-2 py-1 bg-transparent outline-none" /></td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={handleEditSave} className="h-6 px-2 bg-[var(--accent-clay)] text-white rounded text-xs">Save</button>
                          <button onClick={() => setEditingId(null)} className="h-6 px-2 text-xs text-[var(--ink-muted)]">Cancel</button>
                          <button onClick={() => handleDelete(entry.id)} className="h-6 px-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" strokeWidth={2} /></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={entry.id} className="border-b border-[var(--rule)] hover:bg-[var(--muted)] transition-colors">
                      <td className="px-3 py-2.5 text-sm text-[var(--ink-muted)]">{entry.date}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>{entry.type}</span>
                      </td>
                      <td className="px-3 py-2.5 text-sm">{entry.description}</td>
                      <td className="px-3 py-2.5 text-sm text-[var(--ink-muted)]">{entry.category}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-medium">
                        <span className={entry.type === "income" ? "text-green-600" : "text-red-600"}>
                          {entry.type === "income" ? "+" : "-"}{currency} {entry.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-[var(--ink-muted)]">{entry.client}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => handleEdit(entry)} className="p-1 text-[var(--ink-muted)] hover:text-[var(--accent-clay)] transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
