import Link from "next/link";
import {
  Briefcase,
  ArrowRight,
  Users,
  Megaphone,
  Lightbulb,
  Compass,
  Clock,
  CheckSquare,
  Receipt,
} from "lucide-react";
import { db, initPromise } from "@/db";
import {
  clients,
  campaigns,
  ideas,
  discoveries,
  historyEntries,
  tasks,
  invoices,
  leads,
} from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isFounder = user.role === "founder";
  const isManager = user.role === "manager";

  // Fetch stats
  const [allClients, activeCampaignCount, ideasCount, discoveriesCount] =
    await Promise.all([
      db.select().from(clients),
      db
        .select({ value: count() })
        .from(campaigns)
        .where(eq(campaigns.status, "active")),
      db.select({ value: count() }).from(ideas),
      db.select({ value: count() }).from(discoveries),
    ]);

  const activeClients = allClients.filter((c) => !c.archivedAt);

  // Extra stats for founders
  const [taskCount, pendingInvoices, leadCount] = isFounder
    ? await Promise.all([
        db
          .select({ value: count() })
          .from(tasks)
          .where(eq(tasks.status, "todo")),
        db
          .select({ value: count() })
          .from(invoices)
          .where(eq(invoices.status, "sent")),
        db
          .select({ value: count() })
          .from(leads)
          .where(eq(leads.status, "new")),
      ])
    : [null, null, null];

  // Recent activity — last 5 history entries across all clients
  const recentActivity = await db
    .select({
      id: historyEntries.id,
      type: historyEntries.type,
      title: historyEntries.title,
      createdAt: historyEntries.createdAt,
      clientId: historyEntries.clientId,
    })
    .from(historyEntries)
    .orderBy(desc(historyEntries.createdAt))
    .limit(5);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const stats = [
    { label: "Clients", value: activeClients.length, icon: Users, href: "#clients" },
    {
      label: "Active campaigns",
      value: activeCampaignCount[0]?.value ?? 0,
      icon: Megaphone,
      href: "/campaigns",
    },
    {
      label: "Ideas",
      value: ideasCount[0]?.value ?? 0,
      icon: Lightbulb,
      href: "/ideas",
    },
    ...(isFounder
      ? [
          {
            label: "Open tasks",
            value: taskCount?.[0]?.value ?? 0,
            icon: CheckSquare,
            href: "/tasks",
          },
          {
            label: "Pending invoices",
            value: pendingInvoices?.[0]?.value ?? 0,
            icon: Receipt,
            href: "/finance/invoices",
          },
          {
            label: "New leads",
            value: leadCount?.[0]?.value ?? 0,
            icon: Compass,
            href: "/leads",
          },
        ]
      : [
          {
            label: "Discoveries",
            value: discoveriesCount[0]?.value ?? 0,
            icon: Compass,
            href: "/settings",
          },
        ]),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Greeting */}
      <h1 className="text-3xl font-serif font-semibold mb-1">
        {getGreeting()}, {user.name.split(" ")[0]}
      </h1>
      <p className="text-[var(--ink-muted)] mb-8">
        {isFounder
          ? "Here is what is happening across your clients."
          : isManager
          ? "Here is your team overview."
          : "Here is what you have today."}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
        {stats.map((stat) => {
          const inner = (
            <>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon
                  className="w-4 h-4 text-[var(--ink-muted)]"
                  strokeWidth={1.5}
                />
                <span className="text-xs text-[var(--ink-muted)]">
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-semibold font-serif">{stat.value}</p>
            </>
          );

          if (stat.href) {
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4 hover:shadow-card hover:border-[var(--accent-clay)]/30 transition-all duration-200"
              >
                {inner}
              </Link>
            );
          }

          return (
            <div
              key={stat.label}
              className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {/* Recent activity — founders and managers */}
      {(isFounder || isManager) && recentActivity.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-[var(--ink-muted)] uppercase tracking-wide mb-3">
            Recent activity
          </h2>
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
            {recentActivity.map((entry) => {
              const client = clientMap.get(entry.clientId);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Clock
                    className="w-4 h-4 text-[var(--ink-muted)] shrink-0"
                    strokeWidth={1.5}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      <span className="font-medium">
                        {entry.title || entry.type}
                      </span>
                      {client && (
                        <span className="text-[var(--ink-muted)]">
                          {" "}
                          — {client.name}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--ink-muted)] shrink-0">
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Client cards */}
      <section id="clients">
        <h2 className="text-sm font-medium text-[var(--ink-muted)] uppercase tracking-wide mb-3">
          Clients
        </h2>

        {activeClients.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
            <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Briefcase
                className="w-5 h-5 text-[var(--ink-muted)]"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-sm font-medium mb-1">No clients yet</p>
            <p className="text-xs text-[var(--ink-muted)]">
              {isFounder
                ? "Create your first client project to get started."
                : "No clients have been assigned to you yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.slug}`}
                className="group flex items-center justify-between p-4 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] hover:shadow-card transition-shadow duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--muted)] flex items-center justify-center shrink-0">
                    <Briefcase
                      className="w-4 h-4 text-[var(--ink-muted)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {client.name}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] truncate">
                      {client.industry || "No industry"} ·{" "}
                      {client.stage || "No stage"}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="w-4 h-4 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-120 shrink-0"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
