import { NextResponse } from "next/server";
import { isPinSet, validateSession } from "@/lib/auth";

export async function GET() {
  const pinSet = await isPinSet();
  const authenticated = await validateSession();

  return NextResponse.json({ pinSet, authenticated });
}
