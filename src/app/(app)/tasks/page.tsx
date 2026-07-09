import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { db, initPromise } from "@/db";
import { tasks, clients, users } from "@/db/schema";
import { or, eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InlineCreateForm } from "@/components/inline-create-form";
import { TaskList } from "@/components/task-list";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default async function TasksPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allTasks, allClients, activeUsers] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(or(eq(tasks.status, "todo"), eq(tasks.status, "in_progress")))
      .orderBy(desc(tasks.createdAt)),
    db.select().from(clients),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.status, "active")),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const sorted = [...allTasks].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  const listTasks = sorted.map((t) => {
    const client = t.clientId ? clientMap.get(t.clientId) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
      clientId: t.clientId,
      clientName: client?.name ?? null,
      clientSlug: client?.slug ?? null,
    };
  });

  const clientOptions = allClients
    .filter((c) => !c.archivedAt)
    .map((c) => ({ value: c.id, label: c.name }));

  const userOptions = activeUsers.map((u) => ({ value: u.id, label: u.name }));

  const isPrivileged = user.role === "founder" || user.role === "manager";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif font-semibold">Open tasks</h1>
        </div>
        <InlineCreateForm
          buttonLabel="New task"
          apiEndpoint="/api/tasks"
          fields={[
            { name: "title", label: "Title", type: "text", required: true, placeholder: "Task title" },
            { name: "clientId", label: "Client", type: "select", options: clientOptions },
            ...(isPrivileged
              ? [{ name: "assignedTo", label: "Assign to", type: "select" as const, options: userOptions }]
              : []),
            {
              name: "priority",
              label: "Priority",
              type: "select",
              options: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ],
            },
            { name: "dueDate", label: "Due date", type: "date" },
          ]}
        />
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        All tasks with status <span className="font-medium">todo</span> or{" "}
        <span className="font-medium">in progress</span>.
      </p>

      <TaskList
        tasks={listTasks}
        users={activeUsers}
        currentUser={{ id: user.id, role: user.role }}
      />


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
