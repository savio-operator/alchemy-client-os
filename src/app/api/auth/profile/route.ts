import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, initPromise } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  await initPromise;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }

  // Check email uniqueness (if changed)
  if (email !== user.email) {
    const existing = await db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  await db
    .update(users)
    .set({ name, email, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json({ ok: true });
}
