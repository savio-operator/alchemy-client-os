import { NextResponse } from "next/server";
import { postTweet } from "@/lib/integrations/x";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`x:tweet:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const { text } = await request.json();
  if (!text) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  try {
    const result = await postTweet(text);

    await logAudit({
      action: "x.tweet",
      resource: "x/twitter",
      detail: { textLength: text.length },
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Tweet failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
