import Link from "next/link";
import { Compass, ArrowRight, Building2, Globe } from "lucide-react";
import { db, initPromise } from "@/db";
import { leads } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qualified: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  proposal: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-[var(--muted)] text-[var(--ink-muted)]",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  inbound: "Inbound",
  outbound: "Outbound",
  social: "Social",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LeadsPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allLeads = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.createdAt));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-1">
        <Compass className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <h1 className="text-3xl font-serif font-semibold">Leads</h1>
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        All potential clients and business opportunities.
      </p>

      {allLeads.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Compass className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No leads yet</p>
          <p className="text-xs text-[var(--ink-muted)]">
            Add leads to track potential clients.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {allLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lead.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.company && (
                    <span className="flex items-center gap-1 text-xs text-[var(--ink-muted)] truncate">
                      <Building2 className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                      {lead.company}
                    </span>
                  )}
                  {lead.email && (
                    <>
                      {lead.company && (
                        <span className="text-xs text-[var(--ink-muted)]">·</span>
                      )}
                      <span className="text-xs text-[var(--ink-muted)] truncate">
                        {lead.email}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {lead.source && (
                  <span className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                    <Globe className="w-3 h-3" strokeWidth={1.5} />
                    {SOURCE_LABELS[lead.source] ?? lead.source}
                  </span>
                )}

                <span className="text-xs text-[var(--ink-muted)]">
                  {formatDate(lead.createdAt)}
                </span>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_COLORS[lead.status] ?? "bg-[var(--muted)] text-[var(--ink-muted)]"
                  }`}
                >
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
              </div>
            </div>
          ))}
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
