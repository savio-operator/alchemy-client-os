import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { userPresence, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allUsers = await db.select().from(users).where(eq(users.status, "active")).all();

  const result = await Promise.all(
    allUsers.map(async (u) => {
      const presence = await db
        .select()
        .from(userPresence)
        .where(eq(userPresence.userId, u.id))
        .get();

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        status: presence?.status || "offline",
        lastSeenAt: presence?.lastSeenAt || null,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body as { status: string };

  const validStatuses = ["online", "idle", "dnd", "offline"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(userPresence)
    .where(eq(userPresence.userId, user.id))
    .get();

  if (existing) {
    await db
      .update(userPresence)
      .set({ status, lastSeenAt: now })
      .where(eq(userPresence.userId, user.id))
      .run();
  } else {
    await db
      .insert(userPresence)
      .values({ userId: user.id, status, lastSeenAt: now })
      .run();
  }

  return NextResponse.json({ success: true, status });
}
