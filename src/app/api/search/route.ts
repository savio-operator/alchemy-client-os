import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { searchEverything } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`search:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json({ error: "Too many search requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const results = await searchEverything(q);
  return NextResponse.json(results);
}
