import { NextResponse } from "next/server";
import { verifyPin, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { pin } = body as { pin?: string };

  if (!pin || !/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { error: "PIN must be exactly 6 digits" },
      { status: 400 }
    );
  }

  const valid = await verifyPin(pin);
  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 401 }
    );
  }

  await createSession();
  return NextResponse.json({ success: true });
}
