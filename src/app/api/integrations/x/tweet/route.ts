import { NextResponse } from "next/server";
import { postTweet } from "@/lib/integrations/x";

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  try {
    const result = await postTweet(text);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Tweet failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
