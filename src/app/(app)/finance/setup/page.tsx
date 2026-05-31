"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Check } from "lucide-react";

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

export default function SetupPage() {
  const [settings, setSettings] = useState<Settings>({
    expectedMonthlyIncome: 0,
    salaries: [],
    recurringExpenses: [],
    currency: "INR",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/finance/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          currency: data.currency || "INR",
          expectedMonthlyIncome: data.expectedMonthlyIncome || 0,
          salaries: data.salaries || [],
          recurringExpenses: data.recurringExpenses || [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalSalaries = settings.salaries.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = settings.recurringExpenses.reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm text-[var(--ink-muted)]">Loading...</div></div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-serif font-semibold">Finance Setup</h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1">Configure your financial settings</p>

      <div className="mt-6 space-y-6">
        {/* General */}
        <section className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold">General</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Currency</label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Expected Monthly Income</label>
              <input
                type="number"
                value={settings.expectedMonthlyIncome || ""}
                onChange={(e) => setSettings({ ...settings, expectedMonthlyIncome: Number(e.target.value) })}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                placeholder="0"
              />
            </div>
          </div>
        </section>

        {/* Salaries */}
        <section className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Monthly Salaries</h2>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">Total: {settings.currency} {totalSalaries.toLocaleString()}</p>
            </div>
            <button onClick={() => setSettings({ ...settings, salaries: [...settings.salaries, { name: "", amount: 0 }] })}
              className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-[var(--accent-clay)] hover:bg-[var(--muted)] rounded transition-colors">
              <Plus className="w-3 h-3" strokeWidth={2} /> Add
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {settings.salaries.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={s.name} onChange={(e) => {
                  const updated = [...settings.salaries];
                  updated[i] = { ...updated[i], name: e.target.value };
                  setSettings({ ...settings, salaries: updated });
                }} placeholder="Employee name" className="flex-1 text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
                <input type="number" value={s.amount || ""} onChange={(e) => {
                  const updated = [...settings.salaries];
                  updated[i] = { ...updated[i], amount: Number(e.target.value) };
                  setSettings({ ...settings, salaries: updated });
                }} placeholder="Amount" className="w-28 text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
                <button onClick={() => setSettings({ ...settings, salaries: settings.salaries.filter((_, idx) => idx !== i) })}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {settings.salaries.length === 0 && <p className="text-xs text-[var(--ink-muted)]">No salaries configured</p>}
          </div>
        </section>

        {/* Recurring Expenses */}
        <section className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Recurring Expenses</h2>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">Total: {settings.currency} {totalExpenses.toLocaleString()}</p>
            </div>
            <button onClick={() => setSettings({ ...settings, recurringExpenses: [...settings.recurringExpenses, { name: "", amount: 0 }] })}
              className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-[var(--accent-clay)] hover:bg-[var(--muted)] rounded transition-colors">
              <Plus className="w-3 h-3" strokeWidth={2} /> Add
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {settings.recurringExpenses.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={e.name} onChange={(ev) => {
                  const updated = [...settings.recurringExpenses];
                  updated[i] = { ...updated[i], name: ev.target.value };
                  setSettings({ ...settings, recurringExpenses: updated });
                }} placeholder="Expense name" className="flex-1 text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
                <input type="number" value={e.amount || ""} onChange={(ev) => {
                  const updated = [...settings.recurringExpenses];
                  updated[i] = { ...updated[i], amount: Number(ev.target.value) };
                  setSettings({ ...settings, recurringExpenses: updated });
                }} placeholder="Amount" className="w-28 text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
                <button onClick={() => setSettings({ ...settings, recurringExpenses: settings.recurringExpenses.filter((_, idx) => idx !== i) })}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {settings.recurringExpenses.length === 0 && <p className="text-xs text-[var(--ink-muted)]">No recurring expenses configured</p>}
          </div>
        </section>

        {/* Save */}
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--muted)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--ink-muted)]">Total Fixed Monthly Costs</p>
              <p className="text-xl font-bold">{settings.currency} {(totalSalaries + totalExpenses).toLocaleString()}</p>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] text-white hover:bg-[var(--accent-clay)]/90 disabled:opacity-50 transition-colors"
            >
              {saved ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Saved!</> : saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
