import Link from "next/link";
import { Receipt, ArrowRight, AlertCircle } from "lucide-react";
import { db, initPromise } from "@/db";
import { invoices, clients } from "@/db/schema";
import { or, eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InlineCreateForm } from "@/components/inline-create-form";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function InvoicesPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [pendingInvoices, allClients] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(or(eq(invoices.status, "sent"), eq(invoices.status, "overdue")))
      .orderBy(desc(invoices.createdAt)),
    db.select().from(clients),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const totalOutstanding = pendingInvoices.reduce(
    (sum, inv) => sum + inv.amount,
    0
  );

  const clientOptions = allClients
    .filter((c) => !c.archivedAt)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif font-semibold">Pending invoices</h1>
        </div>
        <InlineCreateForm
          buttonLabel="New invoice"
          apiEndpoint="/api/invoices"
          fields={[
            { name: "clientId", label: "Client", type: "select", required: true, options: clientOptions },
            { name: "number", label: "Invoice #", type: "text", required: true, placeholder: "INV-001" },
            { name: "amount", label: "Amount", type: "number", required: true, placeholder: "0" },
            {
              name: "currency",
              label: "Currency",
              type: "select",
              options: [
                { value: "INR", label: "INR" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ],
            },
            { name: "dueDate", label: "Due date", type: "date" },
            { name: "description", label: "Description", type: "text", placeholder: "Brief description" },
          ]}
        />
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        Invoices with status <span className="font-medium">sent</span> or{" "}
        <span className="font-medium">overdue</span>.
        {pendingInvoices.length > 0 && (
          <span className="ml-2 font-medium text-[var(--ink)]">
            Total outstanding:{" "}
            {formatCurrency(totalOutstanding, pendingInvoices[0]?.currency ?? "INR")}
          </span>
        )}
      </p>

      {pendingInvoices.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No pending invoices</p>
          <p className="text-xs text-[var(--ink-muted)]">
            All invoices are paid or in draft.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {pendingInvoices.map((invoice) => {
            const client = clientMap.get(invoice.clientId);
            const isOverdue = invoice.status === "overdue";
            const isDueSoon =
              !isOverdue &&
              invoice.dueDate &&
              new Date(invoice.dueDate) < new Date(Date.now() + 7 * 86400000);

            return (
              <Link
                key={invoice.id}
                href={client ? `/clients/${client.slug}` : "#"}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {invoice.number}
                    {invoice.description && (
                      <span className="text-[var(--ink-muted)] font-normal ml-2">
                        — {invoice.description}
                      </span>
                    )}
                  </p>
                  {client && (
                    <p className="text-xs text-[var(--ink-muted)] truncate mt-0.5">
                      {client.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-semibold font-serif">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>

                  <span
                    className={`flex items-center gap-1 text-xs ${
                      isOverdue
                        ? "text-red-500"
                        : isDueSoon
                        ? "text-orange-500"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {isOverdue && (
                      <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                    )}
                    Due {formatDate(invoice.dueDate)}
                  </span>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isOverdue
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}
                  >
                    {isOverdue ? "Overdue" : "Sent"}
                  </span>

                  <ArrowRight
                    className="w-4 h-4 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    strokeWidth={1.5}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
