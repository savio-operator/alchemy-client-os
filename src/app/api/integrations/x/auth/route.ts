import { NextResponse } from "next/server";
import { getXOAuthUrl } from "@/lib/integrations/x";

export async function GET() {
  try {
    const { url } = getXOAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to start OAuth";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
