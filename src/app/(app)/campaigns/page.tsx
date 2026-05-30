import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { db, initPromise } from "@/db";
import { campaigns, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

export default async function CampaignsPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [activeCampaigns, allClients] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "active"))
      .orderBy(desc(campaigns.createdAt)),
    db.select().from(clients),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const clientOptions = allClients
    .filter((c) => !c.archivedAt)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif font-semibold">Active campaigns</h1>
        </div>
        <InlineCreateForm
          buttonLabel="New campaign"
          apiEndpoint="/api/campaigns"
          fields={[
            { name: "clientId", label: "Client", type: "select", required: true, options: clientOptions },
            {
              name: "type",
              label: "Type",
              type: "select",
              required: true,
              options: [
                { value: "online", label: "Online" },
                { value: "offline", label: "Offline" },
              ],
            },
            { name: "objective", label: "Objective", type: "text", placeholder: "Campaign objective" },
            { name: "channel", label: "Channel", type: "text", placeholder: "e.g. Instagram, TV" },
            { name: "startDate", label: "Start date", type: "date" },
            { name: "endDate", label: "End date", type: "date" },
          ]}
        />
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        All campaigns currently running across your clients.
      </p>

      {activeCampaigns.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No active campaigns</p>
          <p className="text-xs text-[var(--ink-muted)]">
            No campaigns are currently active.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {activeCampaigns.map((campaign) => {
            const client = clientMap.get(campaign.clientId);

            return (
              <Link
                key={campaign.id}
                href={client ? `/clients/${client.slug}` : "#"}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {campaign.objective || "Unnamed campaign"}
                  </p>
                  {client && (
                    <p className="text-xs text-[var(--ink-muted)] truncate mt-0.5">
                      {client.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {campaign.channel && (
                    <span className="text-xs text-[var(--ink-muted)] capitalize">
                      {campaign.channel}
                    </span>
                  )}

                  <span className="text-xs text-[var(--ink-muted)]">
                    {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                  </span>

                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active
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
