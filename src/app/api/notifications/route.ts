import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { startAssistantWatcher } from "@/lib/assistant-watcher";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lazy-start the assistant watcher the same way news-engine piggybacks on
  // /api/news — this route is already polled every 5 min by every logged-in
  // session, so it's a reliable, no-extra-infra place to kick the cron off.
  startAssistantWatcher();

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
    .all();

  const count = items.filter((n) => !n.isRead).length;

  return NextResponse.json({ count, items });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, action } = body as { id?: string; action: "read" | "unread" | "read_all" };

  if (action === "read_all") {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .run();
    return NextResponse.json({ success: true });
  }

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db
    .update(notifications)
    .set({ isRead: action === "read" })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .run();
  } else {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, user.id))
      .run();
  }

  return NextResponse.json({ success: true });
}
