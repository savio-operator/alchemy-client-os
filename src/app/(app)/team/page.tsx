"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Shield,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/store/user";
import { useRouter } from "next/navigation";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function TeamPage() {
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser && currentUser.role !== "founder") {
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
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
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
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
                {activeUsers.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--accent-clay)]/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-[var(--accent-clay)]">
                            {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
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
                        {u.id !== currentUser?.id && (
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
                      </div>
                    </div>
                  </div>
                ))}
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
                            {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
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
