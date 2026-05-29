import { NextResponse } from "next/server";
import { hasUsers, createSession, hashPassword } from "@/lib/auth";
import { createUser } from "@/lib/user";

export async function POST(request: Request) {
  const usersExist = await hasUsers();

  if (usersExist) {
    return NextResponse.json(
      { error: "Setup already complete. Use login instead." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { name, pin } = body as { name?: string; pin?: string };

  if (!name || !pin) {
    return NextResponse.json(
      { error: "Name and PIN are required" },
      { status: 400 }
    );
  }

  if (pin.length < 4 || pin.length > 8) {
    return NextResponse.json(
      { error: "PIN must be 4-8 digits" },
      { status: 400 }
    );
  }

  // Create founder account with PIN as password (no email needed for first user)
  const user = await createUser(
    name.trim(),
    `founder@adchemy.local`,
    pin,
    "founder",
    "active"
  );

  if (!user) {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }

  // Create session for the founder
  await createSession(user.id);

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
