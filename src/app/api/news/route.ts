import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { newsItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  startNewsEngine,
  ensureFreshNews,
  refreshNews,
  NEWS_CATEGORIES,
} from "@/lib/news-engine";
import { desc, eq, like, or, and, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  // Lazy-start the cron engine and top up stale data without blocking
  // the response when we already have items to show.
  startNewsEngine();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const conditions: SQL[] = [];
  if (category && (NEWS_CATEGORIES as readonly string[]).includes(category)) {
    conditions.push(eq(newsItems.category, category));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(like(newsItems.title, pattern), like(newsItems.summary, pattern))!
    );
  }

  let query = db.select().from(newsItems).$dynamic();
  if (conditions.length > 0) {
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const items = await query
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt))
    .limit(limit)
    .offset(offset)
    .all();

  // If the table is empty (first run), fetch synchronously so the user
  // sees content; otherwise refresh in the background.
  if (items.length === 0 && offset === 0) {
    await ensureFreshNews();
    const fresh = await query
      .orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt))
      .limit(limit)
      .all();
    return NextResponse.json({ items: fresh });
  }

  ensureFreshNews().catch(() => {});

  return NextResponse.json({ items });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;
  await refreshNews();

  return NextResponse.json({ success: true });
}
