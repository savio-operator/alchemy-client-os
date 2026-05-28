import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendance, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view"); // "team" for founders/managers

  if (view === "team" && (user.role === "founder" || user.role === "manager")) {
    // Team attendance: all users' records for the current month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const allRecords = await db.select().from(attendance).all();
    const monthRecords = allRecords.filter((r) => r.date >= monthStart);

    const allUsers = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.status, "active"))
      .all();

    return NextResponse.json({
      users: allUsers,
      records: monthRecords,
    });
  }

  // Own attendance
  const records = await db
    .select()
    .from(attendance)
    .where(eq(attendance.userId, user.id))
    .orderBy(desc(attendance.date))
    .limit(90)
    .all();

  const today = new Date().toISOString().split("T")[0];
  const markedToday = records.some((r) => r.date === today);

  return NextResponse.json({ records, markedToday });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  // Check if already marked
  const existing = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, user.id), eq(attendance.date, today)))
    .get();

  if (existing) {
    return NextResponse.json({ error: "Already marked for today" }, { status: 409 });
  }

  await db
    .insert(attendance)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      date: today,
      markedAt: now,
    })
    .run();

  return NextResponse.json({ success: true, date: today });
}
