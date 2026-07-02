"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Shield,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trophy,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/store/user";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// ---- Types ----

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string;
  assignedBy: string;
  status: string;
  reward: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Helpers ----

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function priorityClass(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
    case "medium": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    default: return "bg-[var(--muted)] text-[var(--ink-muted)]";
  }
}

function statusClass(s: string) {
  switch (s) {
    case "done": case "completed": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "in_progress": return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    default: return "bg-[var(--muted)] text-[var(--ink-muted)]";
  }
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ---- Assign Task Form ----

interface AssignTaskFormProps {
  userId: string;
  onDone: (task: Task) => void;
  onCancel: () => void;
}

function AssignTaskForm({ userId, onDone, onCancel }: AssignTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description || null, priority, dueDate: dueDate || null, assignedTo: userId }),
      });
      if (res.ok) {
        const task = await res.json();
        onDone(task);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--muted)] space-y-2">
      <p className="text-xs font-medium text-[var(--ink-muted)]">New task</p>
      <input
        type="text"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] resize-none"
      />
      <div className="flex gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving}>
          {saving ? "Saving…" : "Assign"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- Assign Challenge Form ----

interface AssignChallengeFormProps {
  userId: string;
  onDone: (challenge: Challenge) => void;
  onCancel: () => void;
}

function AssignChallengeForm({ userId, onDone, onCancel }: AssignChallengeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description || null, reward: reward || null, dueDate: dueDate || null, assignedTo: userId }),
      });
      if (res.ok) {
        const challenge = await res.json();
        onDone(challenge);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--muted)] space-y-2">
      <p className="text-xs font-medium text-[var(--ink-muted)]">New challenge</p>
      <input
        type="text"
        placeholder="Challenge title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] resize-none"
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Reward (optional)"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] flex-1"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving}>
          {saving ? "Saving…" : "Assign"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- Member Detail Panel ----

interface MemberPanelProps {
  member: TeamUser;
  currentUser: { id: string; role: string };
}

function MemberPanel({ member, currentUser }: MemberPanelProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "challenges">("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);

  const isPrivileged = currentUser.role === "founder" || currentUser.role === "manager";

  useEffect(() => {
    setLoadingTasks(true);
    fetch(`/api/tasks?assignedTo=${member.id}`)
      .then((r) => r.json())
      .then((data) => { setTasks(Array.isArray(data) ? data : []); setLoadingTasks(false); })
      .catch(() => setLoadingTasks(false));

    setLoadingChallenges(true);
    fetch(`/api/challenges?userId=${member.id}`)
      .then((r) => r.json())
      .then((data) => { setChallenges(Array.isArray(data) ? data : []); setLoadingChallenges(false); })
      .catch(() => setLoadingChallenges(false));
  }, [member.id]);

  async function updateTaskStatus(taskId: string, status: string) {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    }
  }

  async function updateChallengeStatus(challengeId: string, status: string) {
    const res = await fetch(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setChallenges((prev) => prev.map((c) => (c.id === challengeId ? updated : c)));
    }
  }

  const taskNextStatus: Record<string, string> = { todo: "in_progress", in_progress: "done", done: "todo" };
  const taskNextLabel: Record<string, string> = { todo: "Start", in_progress: "Done", done: "Reopen" };

  return (
    <div className="mt-3 border-t border-[var(--rule)] pt-3">
      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors ${
            activeTab === "tasks"
              ? "bg-[var(--accent-clay)] text-white"
              : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
          }`}
        >
          <ClipboardList className="w-3 h-3" strokeWidth={1.5} />
          Tasks
          {tasks.length > 0 && (
            <span className="ml-0.5 opacity-70">({tasks.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("challenges")}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors ${
            activeTab === "challenges"
              ? "bg-[var(--accent-clay)] text-white"
              : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
          }`}
        >
          <Trophy className="w-3 h-3" strokeWidth={1.5} />
          Challenges
          {challenges.length > 0 && (
            <span className="ml-0.5 opacity-70">({challenges.length})</span>
          )}
        </button>
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div>
          {loadingTasks ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 && !showTaskForm ? (
            <p className="text-xs text-[var(--ink-muted)] py-2">No tasks assigned</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-[var(--radius-sm)] bg-[var(--muted)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${task.status === "done" ? "line-through text-[var(--ink-muted)]" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityClass(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusClass(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      {task.dueDate && (
                        <span className="text-[10px] text-[var(--ink-muted)]">
                          Due {fmtDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(isPrivileged || currentUser.id === member.id) && task.status !== "done" && (
                    <button
                      onClick={() => updateTaskStatus(task.id, taskNextStatus[task.status] ?? "in_progress")}
                      className="text-[10px] shrink-0 px-2 py-1 rounded border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] transition-colors"
                    >
                      {taskNextLabel[task.status] ?? "Update"}
                    </button>
                  )}
                  {task.status === "done" && (isPrivileged || currentUser.id === member.id) && (
                    <button
                      onClick={() => updateTaskStatus(task.id, "todo")}
                      className="text-[10px] shrink-0 px-2 py-1 rounded border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Assign task form */}
          {showTaskForm && (
            <AssignTaskForm
              userId={member.id}
              onDone={(task) => {
                setTasks((prev) => [task, ...prev]);
                setShowTaskForm(false);
              }}
              onCancel={() => setShowTaskForm(false)}
            />
          )}

          {isPrivileged && !showTaskForm && (
            <button
              onClick={() => setShowTaskForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Assign task
            </button>
          )}
        </div>
      )}

      {/* Challenges Tab */}
      {activeTab === "challenges" && (
        <div>
          {loadingChallenges ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : challenges.length === 0 && !showChallengeForm ? (
            <p className="text-xs text-[var(--ink-muted)] py-2">No challenges yet</p>
          ) : (
            <div className="space-y-1.5">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-[var(--radius-sm)] bg-[var(--muted)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${challenge.status === "completed" ? "line-through text-[var(--ink-muted)]" : ""}`}>
                      {challenge.title}
                    </p>
                    {challenge.description && (
                      <p className="text-[10px] text-[var(--ink-muted)] mt-0.5 truncate">{challenge.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusClass(challenge.status)}`}>
                        {challenge.status}
                      </span>
                      {challenge.reward && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          {challenge.reward}
                        </span>
                      )}
                      {challenge.dueDate && (
                        <span className="text-[10px] text-[var(--ink-muted)]">
                          Due {fmtDate(challenge.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(isPrivileged || currentUser.id === member.id) && challenge.status === "active" && (
                    <button
                      onClick={() => updateChallengeStatus(challenge.id, "completed")}
                      className="text-[10px] shrink-0 px-2 py-1 rounded border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Assign challenge form */}
          {showChallengeForm && (
            <AssignChallengeForm
              userId={member.id}
              onDone={(challenge) => {
                setChallenges((prev) => [challenge, ...prev]);
                setShowChallengeForm(false);
              }}
              onCancel={() => setShowChallengeForm(false)}
            />
          )}

          {isPrivileged && !showChallengeForm && (
            <button
              onClick={() => setShowChallengeForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Assign challenge
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

export default function TeamPage() {
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isPrivileged = currentUser?.role === "founder" || currentUser?.role === "manager";

  useEffect(() => {
    if (currentUser && currentUser.role !== "founder" && currentUser.role !== "manager") {
      router.replace("/");
      return;
    }
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setTeamUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser, router]);

  const handleApprove = async (userId: string, role: string) => {
    await fetch(`/api/users/${userId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", role }),
    });
    setTeamUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: "active", role } : u
      )
    );
  };

  const handleReject = async (userId: string) => {
    await fetch(`/api/users/${userId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    setTeamUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: "rejected" } : u))
    );
  };

  const handleChangeRole = async (userId: string, role: string) => {
    await fetch(`/api/users/${userId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_role", role }),
    });
    setTeamUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
  };

  const pendingUsers = teamUsers.filter((u) => u.status === "pending");
  const activeUsers = teamUsers.filter((u) => u.status === "active");
  const rejectedUsers = teamUsers.filter((u) => u.status === "rejected");

  function toggleExpand(userId: string) {
    setExpandedId((prev) => (prev === userId ? null : userId));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold font-serif">Team</h1>
        <Badge variant="secondary" className="text-xs">
          {activeUsers.length} active
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending approvals */}
          {pendingUsers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-amber-600" strokeWidth={1.5} />
                <h2 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Pending approvals ({pendingUsers.length})
                </h2>
              </div>
              <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 divide-y divide-amber-200 dark:divide-amber-800">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {initials(u.name)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-green-600 h-7 text-xs"
                        onClick={() => handleApprove(u.id, "member")}
                      >
                        <Check className="w-3 h-3" strokeWidth={2} />
                        Member
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-blue-600 h-7 text-xs"
                        onClick={() => handleApprove(u.id, "manager")}
                      >
                        <Check className="w-3 h-3" strokeWidth={2} />
                        Manager
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive h-7 text-xs"
                        onClick={() => handleReject(u.id)}
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active members */}
          <section>
            <h2 className="text-sm font-medium mb-3">Active members</h2>
            {activeUsers.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-8 text-center">
                <p className="text-sm text-[var(--ink-muted)]">No team members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeUsers.map((u) => {
                  const isExpanded = expandedId === u.id;
                  const canExpand = isPrivileged || currentUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden"
                    >
                      {/* Header row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--accent-clay)]/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-[var(--accent-clay)]">
                              {initials(u.name)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-[var(--ink-muted)]">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              u.role === "founder"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                : u.role === "manager"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : ""
                            }`}
                          >
                            {u.role}
                          </Badge>
                          {isPrivileged && u.id !== currentUser?.id && (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                              className="text-xs h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
                            >
                              <option value="member">Member</option>
                              <option value="manager">Manager</option>
                              <option value="founder">Founder</option>
                            </select>
                          )}
                          {canExpand && (
                            <button
                              onClick={() => toggleExpand(u.id)}
                              className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--muted)] transition-colors"
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
                              ) : (
                                <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && currentUser && (
                          <motion.div
                            key="panel"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4">
                              <MemberPanel member={u} currentUser={currentUser} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Rejected */}
          {rejectedUsers.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[var(--ink-muted)] mb-3">
                Rejected ({rejectedUsers.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {rejectedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
                          <span className="text-xs font-medium text-[var(--ink-muted)]">
                            {initials(u.name)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm">{u.name}</p>
                          <p className="text-xs text-[var(--ink-muted)]">{u.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-green-600 h-7 text-xs"
                        onClick={() => handleApprove(u.id, "member")}
                      >
                        <Check className="w-3 h-3" strokeWidth={2} />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
