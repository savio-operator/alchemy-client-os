"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/store/user";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  markedAt: string;
}

interface TeamUser {
  id: string;
  name: string;
  role: string;
}

export default function AttendancePage() {
  const { user } = useUser();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [markedToday, setMarkedToday] = useState(false);
  const [marking, setMarking] = useState(false);
  const [view, setView] = useState<"self" | "team">("self");
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamRecords, setTeamRecords] = useState<AttendanceRecord[]>([]);

  const isLeader = user?.role === "founder" || user?.role === "manager";

  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records || []);
        setMarkedToday(data.markedToday || false);
      });
  }, []);

  useEffect(() => {
    if (view === "team" && isLeader) {
      fetch("/api/attendance?view=team")
        .then((r) => r.json())
        .then((data) => {
          setTeamUsers(data.users || []);
          setTeamRecords(data.records || []);
        });
    }
  }, [view, isLeader]);

  const handleMark = async () => {
    setMarking(true);
    const res = await fetch("/api/attendance", { method: "POST" });
    if (res.ok) {
      setMarkedToday(true);
      const data = await res.json();
      setRecords((prev) => [
        { id: data.date, userId: user?.id || "", date: data.date, markedAt: new Date().toISOString() },
        ...prev,
      ]);
    }
    setMarking(false);
  };

  const today = new Date().toISOString().split("T")[0];

  // Build calendar grid for current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const markedDates = new Set(records.map((r) => r.date));

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-serif">Attendance</h1>
        {isLeader && (
          <div className="flex gap-1">
            <Button
              variant={view === "self" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("self")}
            >
              My attendance
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
          {/* Mark present */}
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-6 mb-6 text-center">
            {markedToday ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" strokeWidth={2} />
                </div>
                <p className="text-sm font-medium">Present today</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Marked at{" "}
                  {records[0]?.markedAt
                    ? new Date(records[0].markedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "now"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <CalendarCheck
                  className="w-8 h-8 text-[var(--ink-muted)]"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-[var(--ink-muted)]">
                  Mark your attendance for today
                </p>
                <Button
                  onClick={handleMark}
                  disabled={marking}
                  className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                >
                  {marking ? "Marking..." : "Mark present"}
                </Button>
              </div>
            )}
          </div>

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
                const isMarked = markedDates.has(dateStr);
                const isToday = dateStr === today;

                return (
                  <div
                    key={day}
                    className={`h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-xs ${
                      isMarked
                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium"
                        : isToday
                        ? "border border-[var(--accent-clay)] font-medium"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Team view */
        <div className="space-y-3">
          {teamUsers.map((u) => {
            const userRecords = teamRecords.filter((r) => r.userId === u.id);
            const markedTodayTeam = userRecords.some((r) => r.date === today);

            return (
              <div
                key={u.id}
                className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-clay)]/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-[var(--accent-clay)]">
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
                      <p className="text-xs text-[var(--ink-muted)]">
                        {userRecords.length} days this month
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${
                      markedTodayTeam
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {markedTodayTeam ? "Present" : "Absent"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
