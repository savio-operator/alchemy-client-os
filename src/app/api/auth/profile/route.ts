import { NextResponse } from "next/server";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
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

  const { name, email, currentPassword } = await request.json();

  // Name-only update (from top bar pencil) doesn't need password
  if (name && !email) {
    await db
      .update(users)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run();
    return NextResponse.json({ ok: true });
  }

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }

  // Email change requires current password
  if (email !== user.email) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required to change email" }, { status: 403 });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }
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
