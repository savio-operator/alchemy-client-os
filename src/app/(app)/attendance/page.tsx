"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Clock, Users, Check, Circle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/store/user";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  markedAt: string;
  status: string;
  notes: string | null;
}

interface TeamUser {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  clientId: string | null;
  clientName?: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: "bg-red-100 dark:bg-red-950", text: "text-red-700 dark:text-red-300", label: "Urgent" },
  high: { bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300", label: "High" },
  medium: { bg: "bg-yellow-100 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300", label: "Medium" },
  low: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", label: "Low" },
};

export default function CompletionPage() {
  const { user } = useUser();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [markedToday, setMarkedToday] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [view, setView] = useState<"self" | "team">("self");
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamRecords, setTeamRecords] = useState<AttendanceRecord[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);

  // Tasks state
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  // Form state
  const [selectedStatus, setSelectedStatus] = useState<"completed" | "in_progress" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLeader = user?.role === "founder" || user?.role === "manager";

  const today = new Date().toISOString().split("T")[0];

  const fetchTasks = useCallback(() => {
    if (!user?.id) return;
    setLoadingTasks(true);
    fetch(`/api/tasks?assignedTo=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        const taskList: Task[] = Array.isArray(data) ? data : [];
        setMyTasks(taskList);
      })
      .catch(() => setMyTasks([]))
      .finally(() => setLoadingTasks(false));
  }, [user?.id]);

  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records || []);
        setMarkedToday(data.markedToday || false);
        setTodayRecord(data.todayRecord || null);
      });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (view === "team" && isLeader) {
      fetch("/api/attendance?view=team")
        .then((r) => r.json())
        .then((data) => {
          setTeamUsers(data.users || []);
          setTeamRecords(data.records || []);
        });
      // Fetch all tasks for team view
      fetch("/api/tasks")
        .then((r) => r.json())
        .then((data) => {
          setTeamTasks(Array.isArray(data) ? data : []);
        });
    }
  }, [view, isLeader]);

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    setTogglingTask(task.id);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMyTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
    } finally {
      setTogglingTask(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStatus) return;
    setSubmitting(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus, notes }),
    });
    if (res.ok) {
      const data = await res.json();
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        userId: user?.id || "",
        date: data.date,
        markedAt: new Date().toISOString(),
        status: data.status,
        notes: data.notes,
      };
      setMarkedToday(true);
      setTodayRecord(newRecord);
      setRecords((prev) => [newRecord, ...prev]);
    }
    setSubmitting(false);
  };

  // Calendar calculations
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const recordByDate = new Map(records.map((r) => [r.date, r]));

  // Group tasks
  const inProgressTasks = myTasks.filter((t) => t.status === "in_progress");
  const todoTasks = myTasks.filter((t) => t.status === "todo");
  const completedTodayTasks = myTasks.filter(
    (t) => t.status === "done" && t.completedAt && t.completedAt.startsWith(today)
  );

  const hasAnyTasks = myTasks.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-[var(--accent-clay)]" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold font-serif">Completion</h1>
        </div>
        {isLeader && (
          <div className="flex gap-1">
            <Button
              variant={view === "self" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("self")}
            >
              My status
            </Button>
            <Button
              variant={view === "team" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("team")}
              className="gap-1"
            >
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
              Team
            </Button>
          </div>
        )}
      </div>

      {view === "self" ? (
        <>
          {/* Today's Tasks */}
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5 mb-6">
            <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              Today&apos;s Tasks
            </h2>

            {loadingTasks ? (
              <p className="text-sm text-[var(--ink-muted)] text-center py-6">Loading tasks...</p>
            ) : !hasAnyTasks ? (
              <p className="text-sm text-[var(--ink-muted)] text-center py-6">No tasks assigned to you</p>
            ) : (
              <div className="space-y-5">
                {/* In Progress */}
                {inProgressTasks.length > 0 && (
                  <TaskGroup
                    label="In Progress"
                    tasks={inProgressTasks}
                    togglingTask={togglingTask}
                    onToggle={handleToggleTask}
                  />
                )}

                {/* To Do */}
                {todoTasks.length > 0 && (
                  <TaskGroup
                    label="To Do"
                    tasks={todoTasks}
                    togglingTask={togglingTask}
                    onToggle={handleToggleTask}
                  />
                )}

                {/* Completed Today */}
                {completedTodayTasks.length > 0 && (
                  <TaskGroup
                    label="Completed Today"
                    tasks={completedTodayTasks}
                    togglingTask={togglingTask}
                    onToggle={handleToggleTask}
                  />
                )}
              </div>
            )}
          </div>

          {/* Daily summary */}
          {hasAnyTasks && (
            <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-6 mb-6">
              {markedToday && todayRecord ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  {todayRecord.status === "completed" ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">Tasks Completed</p>
                        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                          Reported at{" "}
                          {new Date(todayRecord.markedAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {todayRecord.notes && (
                        <p className="text-sm text-[var(--ink-muted)] italic max-w-sm">
                          &ldquo;{todayRecord.notes}&rdquo;
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-600" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Still Working</p>
                        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                          Reported at{" "}
                          {new Date(todayRecord.markedAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {todayRecord.notes && (
                        <p className="text-sm text-[var(--ink-muted)] italic max-w-sm">
                          &ldquo;{todayRecord.notes}&rdquo;
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : selectedStatus === null ? (
                <div>
                  <p className="text-sm text-[var(--ink-muted)] mb-4 text-center">
                    How are your tasks going today?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedStatus("completed")}
                      className="flex-1 flex flex-col items-center gap-2 p-4 rounded-[var(--radius)] border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-950/70 transition-colors"
                    >
                      <CheckCircle className="w-7 h-7 text-green-600" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Tasks Completed</span>
                    </button>
                    <button
                      onClick={() => setSelectedStatus("in_progress")}
                      className="flex-1 flex flex-col items-center gap-2 p-4 rounded-[var(--radius)] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 transition-colors"
                    >
                      <Clock className="w-7 h-7 text-amber-600" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Still Working</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setSelectedStatus(null)}
                      className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                    >
                      ← Back
                    </button>
                    <span className="text-sm font-medium">
                      {selectedStatus === "completed" ? (
                        <span className="text-green-700 dark:text-green-400">Tasks Completed</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Still Working</span>
                      )}
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      selectedStatus === "completed"
                        ? "Any suggestions or feedback for tomorrow? (optional)"
                        : "How long do you think it will take? (optional)"
                    }
                    rows={3}
                    className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] p-3 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)] transition-colors"
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="mt-3 bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                  >
                    {submitting ? "Submitting..." : (
                      <span className="flex items-center gap-2">
                        <Check className="w-4 h-4" strokeWidth={2} />
                        Submit
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Calendar */}
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-medium mb-3">
              {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-[10px] text-[var(--ink-muted)] py-1">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const record = recordByDate.get(dateStr);
                const isToday = dateStr === today;

                let cellClass = "text-[var(--ink-muted)]";
                let dotEl: React.ReactNode = null;

                if (record) {
                  if (record.status === "completed") {
                    cellClass = "text-green-700 dark:text-green-300 font-medium";
                    dotEl = <span className="block w-1.5 h-1.5 rounded-full bg-green-500 mx-auto mt-0.5" />;
                  } else {
                    cellClass = "text-amber-700 dark:text-amber-300 font-medium";
                    dotEl = <span className="block w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto mt-0.5" />;
                  }
                } else {
                  dotEl = <span className="block w-1.5 h-1.5 rounded-full bg-[var(--rule)] mx-auto mt-0.5" />;
                }

                return (
                  <div
                    key={day}
                    className={`h-9 flex flex-col items-center justify-center rounded-[var(--radius-sm)] text-xs ${cellClass} ${
                      isToday ? "border border-[var(--accent-clay)]" : ""
                    }`}
                  >
                    <span>{day}</span>
                    {dotEl}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-[var(--ink-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> In progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--rule)] inline-block" /> Not reported
              </span>
            </div>
          </div>
        </>
      ) : (
        /* Team view */
        <div className="space-y-3">
          {teamUsers.map((u) => {
            const userRecords = teamRecords.filter((r) => r.userId === u.id);
            const todayRec = userRecords.find((r) => r.date === today);
            const completedThisMonth = userRecords.filter((r) => r.status === "completed").length;
            const userTasks = teamTasks.filter((t) => t.assignedTo === u.id);
            const userDoneTasks = userTasks.filter((t) => t.status === "done");

            return (
              <div
                key={u.id}
                className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-clay)]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-[var(--accent-clay)]">
                        {u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-[var(--ink-muted)] capitalize">{u.role}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {todayRec ? (
                      todayRec.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle className="w-3 h-3" strokeWidth={2} />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="w-3 h-3" strokeWidth={2} />
                          In Progress
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--ink-muted)]">
                        Not reported
                      </span>
                    )}
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">
                      {completedThisMonth} completed this month
                    </p>
                    {userTasks.length > 0 && (
                      <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                        {userDoneTasks.length}/{userTasks.length} tasks done
                      </p>
                    )}
                  </div>
                </div>
                {todayRec?.notes && (
                  <p className="mt-3 text-xs text-[var(--ink-muted)] italic border-t border-[var(--rule)] pt-2">
                    &ldquo;{todayRec.notes}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
          {teamUsers.length === 0 && (
            <p className="text-sm text-[var(--ink-muted)] text-center py-8">No active team members found.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Task Group Component ---- */

function TaskGroup({
  label,
  tasks,
  togglingTask,
  onToggle,
}: {
  label: string;
  tasks: Task[];
  togglingTask: string | null;
  onToggle: (task: Task) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} toggling={togglingTask === task.id} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

/* ---- Task Card Component ---- */

function TaskCard({
  task,
  toggling,
  onToggle,
}: {
  task: Task;
  toggling: boolean;
  onToggle: (task: Task) => void;
}) {
  const isDone = task.status === "done";
  const prio = priorityStyles[task.priority] || priorityStyles.medium;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--rule)] ${
        isDone ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={() => onToggle(task)}
        disabled={toggling}
        className="mt-0.5 shrink-0 transition-colors"
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
      >
        {isDone ? (
          <CheckCircle className="w-5 h-5 text-green-600" strokeWidth={1.5} />
        ) : (
          <Circle className="w-5 h-5 text-[var(--ink-muted)] hover:text-[var(--accent-clay)]" strokeWidth={1.5} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isDone ? "line-through text-[var(--ink-muted)]" : "font-medium"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${prio.bg} ${prio.text}`}>
            {prio.label}
          </span>
          {task.clientName && (
            <span className="text-[10px] text-[var(--ink-muted)]">{task.clientName}</span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-[var(--ink-muted)]">Due {task.dueDate}</span>
          )}
        </div>
      </div>
    </div>
  );
}
