import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/user";
import { notifyFounders } from "@/lib/notifications";

export async function POST(request: Request) {
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

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  await createUser(name.trim(), email.trim(), password, "member", "pending");

  // Notify all founders about the new registration
  await notifyFounders(
    "registration_request",
    `${name.trim()} requested to join`,
    `${email.trim()} wants to join the team.`,
    "/settings?tab=team"
  );

  return NextResponse.json({
    success: true,
    message: "Registration submitted. Waiting for founder approval.",
  });
}
