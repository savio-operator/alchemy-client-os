import { db, initPromise } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import crypto from "crypto";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  await initPromise;
  await db
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      userId,
      type,
      title,
      body: body || null,
      link: link || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export async function getUnreadCount(userId: string): Promise<number> {
  await initPromise;
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .get();
  return result?.value ?? 0;
}

export async function notifyFounders(type: string, title: string, body?: string, link?: string) {
  await initPromise;
  const founders = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "founder"), eq(users.status, "active")))
    .all();

  for (const founder of founders) {
    await createNotification(founder.id, type, title, body, link);
  }
}

export async function notifyUser(userId: string, type: string, title: string, body?: string, link?: string) {
  await createNotification(userId, type, title, body, link);
}
