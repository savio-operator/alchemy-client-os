import { NextResponse } from "next/server";
import { isPinSet, hasUsers, createSession } from "@/lib/auth";
import { createUser } from "@/lib/user";
import { db } from "@/db";
import { settings, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  // Only allow if no users exist (fresh install or PIN migration)
  const usersExist = await hasUsers();

  if (usersExist) {
    return NextResponse.json(
      { error: "Setup already complete. Use login instead." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { name, email, password } = body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Create founder account
  const user = await createUser(
    name.trim(),
    email.trim(),
    password,
    "founder",
    "active"
  );

  if (!user) {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }

  // Clean up old PIN if it exists
  const pinSet = await isPinSet();
  if (pinSet) {
    await db.delete(settings).where(eq(settings.key, "pin_hash")).run();
  }

  // Invalidate all old sessions (they have no user_id)
  await db.delete(sessions).run();

  // Create new session for the founder
  await createSession(user.id);

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
