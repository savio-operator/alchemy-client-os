import { NextResponse } from "next/server";
import { getMetaOAuthUrl } from "@/lib/integrations/meta";

export async function GET() {
  try {
    const url = getMetaOAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to start OAuth";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    );
  }
}
