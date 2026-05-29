import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  console.error("CLIENT ERROR REPORT:", JSON.stringify(body, null, 2));
  return NextResponse.json({ ok: true });
}
