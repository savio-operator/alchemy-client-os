import Link from "next/link";
import { CheckSquare, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { db, initPromise } from "@/db";
import { tasks, clients } from "@/db/schema";
import { or, eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-600",
  low: "text-[var(--ink-muted)]",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TasksPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allTasks, allClients] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(or(eq(tasks.status, "todo"), eq(tasks.status, "in_progress")))
      .orderBy(desc(tasks.createdAt)),
    db.select().from(clients),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const sorted = [...allTasks].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-1">
        <CheckSquare className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <h1 className="text-3xl font-serif font-semibold">Open tasks</h1>
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        All tasks with status <span className="font-medium">todo</span> or{" "}
        <span className="font-medium">in progress</span>.
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No open tasks</p>
          <p className="text-xs text-[var(--ink-muted)]">
            All caught up — no tasks are currently open.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {sorted.map((task) => {
            const client = task.clientId ? clientMap.get(task.clientId) : null;
            const isOverdue =
              task.dueDate && new Date(task.dueDate) < new Date();

            return (
              <Link
                key={task.id}
                href={client ? `/clients/${client.slug}` : "#"}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {client && (
                    <p className="text-xs text-[var(--ink-muted)] truncate mt-0.5">
                      {client.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`text-xs font-medium capitalize ${
                      PRIORITY_COLORS[task.priority] ?? "text-[var(--ink-muted)]"
                    }`}
                  >
                    {task.priority}
                  </span>

                  <span
                    className={`flex items-center gap-1 text-xs ${
                      isOverdue
                        ? "text-red-500"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {isOverdue && (
                      <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                    )}
                    {!isOverdue && task.dueDate && (
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                    )}
                    {formatDate(task.dueDate)}
                  </span>

                  <span className="text-xs text-[var(--ink-muted)] capitalize">
                    {task.status === "in_progress" ? "In progress" : "Todo"}
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
