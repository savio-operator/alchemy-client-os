import { NextResponse } from "next/server";
import { isPinSet, setPin, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const pinAlreadySet = await isPinSet();
  if (pinAlreadySet) {
    return NextResponse.json(
      { error: "PIN already set" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { pin } = body as { pin?: string };

  if (!pin || !/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { error: "PIN must be exactly 6 digits" },
      { status: 400 }
    );
  }

  await setPin(pin);
  await createSession();

  return NextResponse.json({ success: true });
}
