import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const keys = searchParams.get("keys")?.split(",").filter(Boolean) || [];

  if (keys.length === 0) {
    const all = await db.select().from(settings).all();
    const result: Record<string, string> = {};
    for (const row of all) result[row.key] = row.value;
    return NextResponse.json(result);
  }

  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, keys))
    .all();

  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initPromise;

  const body = await request.json().catch(() => ({}));

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      await db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      await db.insert(settings).values({ key, value }).run();
    }
  }

  return NextResponse.json({ success: true });
}
