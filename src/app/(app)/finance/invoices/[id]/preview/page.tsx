"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PaymentDetails {
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
}

interface InvoiceData {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  description: string | null;
  taxPercent: number;
  discountAmount: number;
  notes: string | null;
  fromName: string | null;
  fromAddress: string | null;
  fromGst: string | null;
  paymentDetails: string | null;
  createdAt: string;
  items: LineItem[];
  client: { id: string; name: string } | null;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push("/invoices");
          return;
        }
        setInvoice(data);
        setLoading(false);
      });
  }, [id, router]);

  if (loading || !invoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-muted)]" />
      </div>
    );
  }

  const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const taxAmount = subtotal * ((invoice.taxPercent || 0) / 100);
  const total = subtotal + taxAmount - (invoice.discountAmount || 0);

  const pd: PaymentDetails = invoice.paymentDetails
    ? (typeof invoice.paymentDetails === "string" ? JSON.parse(invoice.paymentDetails) : invoice.paymentDetails)
    : {};
  const hasBank = pd.bankName || pd.bankAccount;
  const hasUpi = pd.upiId;
  const hasPaymentInfo = hasBank || hasUpi;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 40px !important; max-width: none !important; }
        }
      `}</style>

      {/* Action bar — hidden in print */}
      <div className="no-print flex items-center justify-between max-w-4xl mx-auto px-6 py-4">
        <button
          onClick={() => router.push(`/finance/invoices/${id}`)}
          className="flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Back to invoice
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors"
        >
          <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
          Print / Save as PDF
        </button>
      </div>

      {/* Invoice document */}
      <div className="print-page max-w-4xl mx-auto bg-white text-gray-900 p-10 my-4 shadow-lg rounded-lg" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            {invoice.fromName && (
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{invoice.fromName}</h1>
            )}
            {invoice.fromAddress && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.fromAddress}</p>
            )}
            {invoice.fromGst && (
              <p className="text-sm text-gray-500 mt-1">GST: {invoice.fromGst}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-gray-400 tracking-wide mb-2">INVOICE</h2>
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">Invoice #:</span> {invoice.number}
            </p>
            <p className="text-sm text-gray-600">
              <span className="text-gray-500">Date:</span> {formatDate(invoice.createdAt)}
            </p>
            {invoice.dueDate && (
              <p className="text-sm text-gray-600">
                <span className="text-gray-500">Due:</span> {formatDate(invoice.dueDate)}
              </p>
            )}
          </div>
        </div>

        {/* Bill To */}
        {invoice.client && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-base font-semibold text-gray-900">{invoice.client.name}</p>
          </div>
        )}

        {invoice.description && (
          <p className="text-sm text-gray-600 mb-6 italic">{invoice.description}</p>
        )}

        {/* Line items table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4">#</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4">Description</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4">Qty</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4">Rate</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 pr-4 text-sm text-gray-400">{i + 1}</td>
                <td className="py-3 pr-4 text-sm text-gray-900">{item.description}</td>
                <td className="py-3 pr-4 text-sm text-gray-700 text-right">{item.quantity}</td>
                <td className="py-3 pr-4 text-sm text-gray-700 text-right">{formatCurrency(item.rate, invoice.currency)}</td>
                <td className="py-3 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.quantity * item.rate, invoice.currency)}</td>
              </tr>
            ))}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-400">No items</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(subtotal, invoice.currency)}</span>
            </div>
            {(invoice.taxPercent || 0) > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500">Tax ({invoice.taxPercent}%)</span>
                <span className="text-gray-900">{formatCurrency(taxAmount, invoice.currency)}</span>
              </div>
            )}
            {(invoice.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500">Discount</span>
                <span className="text-gray-900">-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes / Terms</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Payment details */}
        {hasPaymentInfo && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Details</p>
            <div className="flex flex-wrap gap-8">
              {hasBank && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Bank Transfer</p>
                  <div className="text-sm text-gray-700 space-y-0.5">
                    {pd.bankName && <p><span className="text-gray-500">Bank:</span> {pd.bankName}</p>}
                    {pd.bankAccount && <p><span className="text-gray-500">A/C No:</span> {pd.bankAccount}</p>}
                    {pd.bankIfsc && <p><span className="text-gray-500">IFSC:</span> {pd.bankIfsc}</p>}
                    {pd.bankBranch && <p><span className="text-gray-500">Branch:</span> {pd.bankBranch}</p>}
                  </div>
                </div>
              )}
              {hasUpi && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">UPI Payment</p>
                  <p className="text-sm text-gray-700"><span className="text-gray-500">UPI ID:</span> {pd.upiId}</p>
                  <p className="text-xs text-gray-400 mt-1">Pay via GPay, PhonePe, Paytm, or any UPI app</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Thank you for your business</p>
        </div>
      </div>
    </>
  );
}
