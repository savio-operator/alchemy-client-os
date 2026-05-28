import { NextResponse } from "next/server";

// Deprecated — use /api/auth/migrate instead
export async function POST() {
  return NextResponse.json(
    { error: "PIN setup is deprecated. Use /api/auth/migrate to create a founder account." },
    { status: 410 }
  );
}
