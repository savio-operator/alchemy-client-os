import { db } from "@/db";
import { userSectionVisits, notifications, chatMessages, chatChannelMembers } from "@/db/schema";
import { eq, and, gt, count } from "drizzle-orm";

export async function trackSectionVisit(userId: string, section: string) {
  const now = new Date().toISOString();
  // Upsert
  try {
    await db
      .insert(userSectionVisits)
      .values({ userId, section, lastVisitedAt: now })
      .onConflictDoUpdate({
        target: [userSectionVisits.userId, userSectionVisits.section],
        set: { lastVisitedAt: now },
      })
      .run();
  } catch {
    // Fallback: update
    await db
      .update(userSectionVisits)
      .set({ lastVisitedAt: now })
      .where(and(eq(userSectionVisits.userId, userId), eq(userSectionVisits.section, section)))
      .run();
  }
}

export async function getLastVisit(userId: string, section: string): Promise<string | null> {
  const row = await db
    .select()
    .from(userSectionVisits)
    .where(and(eq(userSectionVisits.userId, userId), eq(userSectionVisits.section, section)))
    .get();
  return row?.lastVisitedAt || null;
}

export async function getUpdateCounts(userId: string): Promise<Record<string, number>> {
  const sections = ["notifications", "chat"];
  const counts: Record<string, number> = {};

  for (const section of sections) {
    const lastVisit = await getLastVisit(userId, section);

    if (section === "notifications") {
      const result = await db
        .select({ value: count() })
        .from(notifications)
        .where(
          lastVisit
            ? and(eq(notifications.userId, userId), eq(notifications.isRead, false), gt(notifications.createdAt, lastVisit))
            : and(eq(notifications.userId, userId), eq(notifications.isRead, false))
        )
        .get();
      counts[section] = result?.value ?? 0;
    }

    if (section === "chat") {
      // Count unread team chat messages across all channels the user is in
      const memberships = await db
        .select()
        .from(chatChannelMembers)
        .where(eq(chatChannelMembers.userId, userId))
        .all();

      let total = 0;
      for (const m of memberships) {
        const since = m.lastReadAt || "1970-01-01T00:00:00.000Z";
        const result = await db
          .select({ value: count() })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.channelId, m.channelId),
              gt(chatMessages.createdAt, since)
            )
          )
          .get();
        total += result?.value ?? 0;
      }
      counts[section] = total;
    }
  }

  return counts;
}
