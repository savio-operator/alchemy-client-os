import { NextResponse } from "next/server";
import { validateSession, isPinSet, hasUsers } from "@/lib/auth";

export async function GET() {
  const { valid, user } = await validateSession();

  if (valid && user) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  // Check if this is a migration scenario (PIN exists but no users yet)
  const pinSet = await isPinSet();
  const usersExist = await hasUsers();
  const migration = pinSet && !usersExist;

  return NextResponse.json({
    authenticated: false,
    user: null,
    migration,
  });
}
