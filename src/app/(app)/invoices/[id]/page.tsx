"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Save,
  Send,
  Printer,
  Trash2,
  CheckCircle,
} from "lucide-react";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
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
  items: LineItem[];
  client: { id: string; name: string; slug: string } | null;
}

interface ClientOption {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--muted)] text-[var(--ink-muted)]",
  sent: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function InvoiceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromGst, setFromGst] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${id}`).then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()).catch(() => []),
      fetch("/api/settings?keys=businessName,businessAddress,businessGst").then((r) => r.json()).catch(() => ({})),
    ]).then(([inv, clientData, settings]) => {
      setClients(clientData);

      if (inv.error) {
        router.push("/invoices");
        return;
      }

      const data = inv as InvoiceData;
      setInvoiceNumber(data.number);
      setClientId(data.clientId);
      setClientName(data.client?.name || "");
      setCurrency(data.currency);
      setDueDate(data.dueDate || "");
      setDescription(data.description || "");
      setStatus(data.status);
      setTaxPercent(data.taxPercent || 0);
      setDiscountAmount(data.discountAmount || 0);
      setNotes(data.notes || "");
      setFromName(data.fromName || settings.businessName || "");
      setFromAddress(data.fromAddress || settings.businessAddress || "");
      setFromGst(data.fromGst || settings.businessGst || "");

      if (data.items && data.items.length > 0) {
        setItems(data.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          rate: i.rate,
          amount: i.amount,
        })));
      }

      setLoading(false);
    });
  }, [id, router]);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const total = subtotal + taxAmount - discountAmount;

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "rate") {
          updated.amount = (updated.quantity || 0) * (updated.rate || 0);
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      number: invoiceNumber,
      clientId,
      currency,
      dueDate: dueDate || null,
      description: description || null,
      taxPercent,
      discountAmount,
      notes: notes || null,
      fromName: fromName || null,
      fromAddress: fromAddress || null,
      fromGst: fromGst || null,
      items: items.filter((i) => i.description.trim()).map((i) => ({
        description: i.description,
        quantity: i.quantity,
        rate: i.rate,
      })),
    };

    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/invoices");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/invoices")}
          className="flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Invoices
        </button>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || ""}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Save
          </button>
          {status === "draft" && (
            <button
              onClick={() => handleStatusChange("sent")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              Send
            </button>
          )}
          {(status === "sent" || status === "overdue") && (
            <button
              onClick={() => handleStatusChange("paid")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Mark Paid
            </button>
          )}
          <button
            onClick={() => router.push(`/invoices/${id}/preview`)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] hover:bg-[var(--muted)] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
            Preview
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* From / To */}
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wide mb-3">From</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Business name"
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
              />
              <textarea
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="Address"
                rows={2}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)]"
              />
              <input
                type="text"
                value={fromGst}
                onChange={(e) => setFromGst(e.target.value)}
                placeholder="GST number (optional)"
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
              />
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wide mb-3">Bill To</h3>
            <div className="space-y-2">
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const c = clients.find((c) => c.id === e.target.value);
                  setClientName(c?.name || "");
                }}
                className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {clientName && (
                <p className="text-sm font-medium px-1">{clientName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Invoice #</label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief note" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 px-4 py-2 bg-[var(--muted)] text-xs font-medium text-[var(--ink-muted)]">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 px-4 py-2 border-t border-[var(--rule)]">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder="Item description"
                className="text-sm bg-transparent outline-none"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="text-sm text-right bg-transparent outline-none"
              />
              <input
                type="number"
                value={item.rate}
                onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="text-sm text-right bg-transparent outline-none"
              />
              <span className="text-sm text-right font-medium">
                {formatCurrency(item.quantity * item.rate, currency)}
              </span>
              <button
                onClick={() => removeItem(index)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[var(--ink-muted)] hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <div className="px-4 py-2 border-t border-[var(--rule)]">
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs text-[var(--accent-clay)] hover:text-[var(--accent-clay)]/80 font-medium"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Add item
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--ink-muted)]">Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[var(--ink-muted)]">Tax</span>
                <input
                  type="number"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  className="w-14 text-xs border border-[var(--rule)] rounded px-1.5 py-0.5 bg-transparent outline-none text-right"
                />
                <span className="text-xs text-[var(--ink-muted)]">%</span>
              </div>
              <span>{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--ink-muted)]">Discount</span>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                min="0"
                className="w-24 text-sm border border-[var(--rule)] rounded px-1.5 py-0.5 bg-transparent outline-none text-right"
              />
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-[var(--rule)]">
              <span>Total</span>
              <span className="font-serif">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes / Terms */}
        <div>
          <label className="block text-xs text-[var(--ink-muted)] mb-1">Notes / Terms</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Payment terms, bank details, or any notes..."
            className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)]"
          />
        </div>
      </div>
    </div>
  );
}
