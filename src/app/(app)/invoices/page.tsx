"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Send,
  CheckCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  clientId: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  description: string | null;
  taxPercent: number;
  discountAmount: number;
  notes: string | null;
  fromName: string | null;
  fromAddress: string | null;
  fromGst: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  clientName?: string;
}

interface ClientOption {
  id: string;
  name: string;
  slug: string;
}

const STATUS_TABS = ["all", "draft", "sent", "paid", "overdue"] as const;
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--muted)] text-[var(--ink-muted)]",
  sent: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // New invoice form
  const [newInv, setNewInv] = useState({
    clientId: "",
    number: "",
    amount: "",
    currency: "INR",
    dueDate: "",
    description: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()).catch(() => []),
    ]).then(([invData, clientData]) => {
      // Map client names to invoices
      const clientMap = new Map(
        (clientData as ClientOption[]).map((c: ClientOption) => [c.id, c.name])
      );
      const enriched = (invData as Invoice[]).map((inv: Invoice) => ({
        ...inv,
        clientName: clientMap.get(inv.clientId) || "Unknown",
      }));
      setInvoices(enriched);
      setClients(clientData);
      setLoading(false);
    });
  }, []);

  const filtered = activeTab === "all" ? invoices : invoices.filter((i) => i.status === activeTab);

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  const paidThisMonth = invoices
    .filter((i) => {
      if (i.status !== "paid" || !i.paidAt) return false;
      const paid = new Date(i.paidAt);
      const now = new Date();
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
    })
    .reduce((sum, i) => sum + i.amount, 0);

  const statusCounts = STATUS_TABS.reduce((acc, s) => {
    acc[s] = s === "all" ? invoices.length : invoices.filter((i) => i.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInv.clientId || !newInv.number.trim()) return;
    setCreating(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newInv,
        amount: parseFloat(newInv.amount) || 0,
      }),
    });
    if (res.ok) {
      const inv = await res.json();
      const client = clients.find((c) => c.id === inv.clientId);
      setInvoices((prev) => [{ ...inv, clientName: client?.name || "Unknown" }, ...prev]);
      setNewInv({ clientId: "", number: "", amount: "", currency: "INR", dueDate: "", description: "" });
      setShowNewForm(false);
      // Navigate to editor
      router.push(`/invoices/${inv.id}`);
    }
    setCreating(false);
  };

  const handleQuickStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInvoices((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updated } : i))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif font-semibold">Invoices</h1>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--ink)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          New invoice
        </button>
      </div>

      {/* Summary */}
      {(totalOutstanding > 0 || paidThisMonth > 0) && (
        <div className="flex items-center gap-6 mb-6">
          {totalOutstanding > 0 && (
            <p className="text-sm">
              <span className="text-[var(--ink-muted)]">Outstanding: </span>
              <span className="font-semibold text-orange-600">{formatCurrency(totalOutstanding, "INR")}</span>
            </p>
          )}
          {paidThisMonth > 0 && (
            <p className="text-sm">
              <span className="text-[var(--ink-muted)]">Paid this month: </span>
              <span className="font-semibold text-green-600">{formatCurrency(paidThisMonth, "INR")}</span>
            </p>
          )}
        </div>
      )}

      {/* New invoice form */}
      {showNewForm && (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">New invoice</span>
            <button onClick={() => setShowNewForm(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)]">
              <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Client <span className="text-[var(--accent-clay)]">*</span></label>
                <select value={newInv.clientId} onChange={(e) => setNewInv({ ...newInv, clientId: e.target.value })} required className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]">
                  <option value="">Select client...</option>
                  {clients.filter((c: ClientOption & { archivedAt?: string }) => !(c as ClientOption & { archivedAt?: string }).archivedAt).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Invoice # <span className="text-[var(--accent-clay)]">*</span></label>
                <input type="text" value={newInv.number} onChange={(e) => setNewInv({ ...newInv, number: e.target.value })} required placeholder="INV-001" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Amount</label>
                <input type="number" value={newInv.amount} onChange={(e) => setNewInv({ ...newInv, amount: e.target.value })} placeholder="0" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Currency</label>
                <select value={newInv.currency} onChange={(e) => setNewInv({ ...newInv, currency: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Due date</label>
                <input type="date" value={newInv.dueDate} onChange={(e) => setNewInv({ ...newInv, dueDate: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Description</label>
                <input type="text" value={newInv.description} onChange={(e) => setNewInv({ ...newInv, description: e.target.value })} placeholder="Brief description" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">You can add line items after creating the invoice.</p>
            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? "Creating..." : "Create & Edit"}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} className="h-8 px-3 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium capitalize whitespace-nowrap transition-colors ${
              activeTab === tab ? "bg-[var(--accent-clay)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
            }`}
          >
            {tab === "all" ? "All" : STATUS_LABELS[tab]} ({statusCounts[tab] || 0})
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No invoices</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {activeTab === "all" ? "Create your first invoice." : `No ${STATUS_LABELS[activeTab]?.toLowerCase()} invoices.`}
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {filtered.map((inv) => {
            const isOverdue = inv.status === "overdue";
            const isDueSoon = !isOverdue && inv.status === "sent" && inv.dueDate && new Date(inv.dueDate) < new Date(Date.now() + 7 * 86400000);

            return (
              <div key={inv.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors group">
                {/* Main info — clickable */}
                <button
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium truncate">
                    {inv.number}
                    {inv.description && (
                      <span className="text-[var(--ink-muted)] font-normal ml-2">&mdash; {inv.description}</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] truncate mt-0.5">{inv.clientName}</p>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold font-serif">{formatCurrency(inv.amount, inv.currency)}</span>

                  <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : isDueSoon ? "text-orange-500" : "text-[var(--ink-muted)]"}`}>
                    {isOverdue && <AlertCircle className="w-3 h-3" strokeWidth={1.5} />}
                    Due {formatDate(inv.dueDate)}
                  </span>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || ""}`}>
                    {STATUS_LABELS[inv.status] || inv.status}
                  </span>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {inv.status === "draft" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQuickStatus(inv.id, "sent"); }}
                        title="Mark as Sent"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-yellow-100 text-yellow-600"
                      >
                        <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    {(inv.status === "sent" || inv.status === "overdue") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQuickStatus(inv.id, "paid"); }}
                        title="Mark as Paid"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-green-100 text-green-600"
                      >
                        <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}
                      title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  <button onClick={() => router.push(`/invoices/${inv.id}`)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <a href="/" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          &larr; Back to home
        </a>
      </div>
    </div>
  );
}
