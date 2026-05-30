import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { attendance, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view"); // "team" for founders/managers

  if (view === "team" && (user.role === "founder" || user.role === "manager")) {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const allRecords = await db.select().from(attendance).all();
    const monthRecords = allRecords.filter((r) => r.date >= monthStart);

    const allUsers = await db
      .select({ id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.status, "active"))
      .all();

    return NextResponse.json({
      users: allUsers,
      records: monthRecords,
    });
  }

  // Own records
  const records = await db
    .select()
    .from(attendance)
    .where(eq(attendance.userId, user.id))
    .orderBy(desc(attendance.date))
    .limit(90)
    .all();

  const today = new Date().toISOString().split("T")[0];
  const todayRecord = records.find((r) => r.date === today);

  return NextResponse.json({ records, markedToday: !!todayRecord, todayRecord: todayRecord || null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const body = await request.json().catch(() => ({}));
  const status: string = body.status === "in_progress" ? "in_progress" : "completed";
  const notes: string | null = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  // Check if already reported
  const existing = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, user.id), eq(attendance.date, today)))
    .get();

  if (existing) {
    return NextResponse.json({ error: "Already reported for today" }, { status: 409 });
  }

  const record = {
    id: crypto.randomUUID(),
    userId: user.id,
    date: today,
    markedAt: now,
    status,
    notes,
  };

  await db.insert(attendance).values(record).run();

  return NextResponse.json({ success: true, date: today, status, notes });
}
