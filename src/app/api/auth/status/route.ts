import { NextResponse } from "next/server";
import { validateSession, hasUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

  // Check if this is a setup/migration scenario (no users yet)
  const usersExist = await hasUsers();
  const migration = !usersExist;

  return NextResponse.json({
    authenticated: false,
    user: null,
    migration,
  });
}
