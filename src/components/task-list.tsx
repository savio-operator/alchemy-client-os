"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-600",
  low: "text-[var(--ink-muted)]",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};

export interface TaskListTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
}

export interface TaskListUser {
  id: string;
  name: string;
}

interface TaskListProps {
  tasks: TaskListTask[];
  users: TaskListUser[];
  currentUser: { id: string; role: string };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TaskList({ tasks: initialTasks, users, currentUser }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPrivileged =
    currentUser.role === "founder" || currentUser.role === "manager";
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  async function patchTask(id: string, updates: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update task.");
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...data } : t))
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (tasks.filter((t) => t.status !== "done").length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
        <p className="text-sm font-medium mb-1">No open tasks</p>
        <p className="text-xs text-[var(--ink-muted)]">
          All caught up — no tasks are currently open.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
      {tasks
        .filter((t) => t.status !== "done")
        .map((task) => {
          const isExpanded = expandedId === task.id;
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
          const canUpdateStatus =
            isPrivileged || task.assignedTo === currentUser.id;
          const assigneeName = task.assignedTo
            ? userMap.get(task.assignedTo) ?? "Unknown"
            : null;
          const saving = savingId === task.id;

          return (
            <div key={task.id}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setExpandedId((prev) => (prev === task.id ? null : task.id));
                }}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--muted)] transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 min-w-0">
                    {task.clientName && (
                      <span className="text-xs text-[var(--ink-muted)] truncate">
                        {task.clientName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-[var(--ink-muted)] truncate">
                      <User className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                      {assigneeName ?? "Unassigned"}
                    </span>
                  </div>
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
                    className={`hidden sm:flex items-center gap-1 text-xs ${
                      isOverdue ? "text-red-500" : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {isOverdue ? (
                      <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
                    ) : task.dueDate ? (
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                    ) : null}
                    {formatDate(task.dueDate)}
                  </span>

                  <span className="text-xs text-[var(--ink-muted)]">
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[var(--ink-muted)] shrink-0" strokeWidth={1.5} />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--ink-muted)] shrink-0" strokeWidth={1.5} />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 bg-[var(--muted)]/40">
                  {task.description && (
                    <p className="text-sm text-[var(--ink-muted)] mb-3 whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
                    {isPrivileged ? (
                      <label className="block">
                        <span className="block text-xs text-[var(--ink-muted)] mb-1">
                          Assigned to
                        </span>
                        <select
                          value={task.assignedTo ?? ""}
                          disabled={saving}
                          onChange={(e) =>
                            patchTask(task.id, {
                              assignedTo: e.target.value || null,
                            })
                          }
                          className="text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-[var(--surface)] outline-none focus:border-[var(--accent-clay)] transition-colors"
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div>
                        <span className="block text-xs text-[var(--ink-muted)] mb-1">
                          Assigned to
                        </span>
                        <span className="text-sm">{assigneeName ?? "Unassigned"}</span>
                      </div>
                    )}

                    {isPrivileged && (
                      <label className="block">
                        <span className="block text-xs text-[var(--ink-muted)] mb-1">
                          Priority
                        </span>
                        <select
                          value={task.priority}
                          disabled={saving}
                          onChange={(e) =>
                            patchTask(task.id, { priority: e.target.value })
                          }
                          className="text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-[var(--surface)] outline-none focus:border-[var(--accent-clay)] transition-colors"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                    )}

                    {isPrivileged && (
                      <label className="block">
                        <span className="block text-xs text-[var(--ink-muted)] mb-1">
                          Due date
                        </span>
                        <input
                          type="date"
                          value={task.dueDate ?? ""}
                          disabled={saving}
                          onChange={(e) =>
                            patchTask(task.id, { dueDate: e.target.value || null })
                          }
                          className="text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-[var(--surface)] outline-none focus:border-[var(--accent-clay)] transition-colors"
                        />
                      </label>
                    )}

                    {canUpdateStatus && (
                      <div className="flex items-center gap-2">
                        {task.status === "todo" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => patchTask(task.id, { status: "in_progress" })}
                            className="h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] transition-colors disabled:opacity-60"
                          >
                            Start
                          </button>
                        )}
                        {task.status !== "done" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => patchTask(task.id, { status: "done" })}
                            className="h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60"
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    )}

                    {saving && (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ink-muted)] mb-2" />
                    )}
                  </div>

                  {task.clientSlug && (
                    <Link
                      href={`/clients/${task.clientSlug}`}
                      className="inline-flex items-center gap-1 mt-3 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                    >
                      Open client {task.clientName}
                      <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
                    </Link>
                  )}

                  {error && expandedId === task.id && (
                    <p className="text-xs text-red-500 mt-2">{error}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
