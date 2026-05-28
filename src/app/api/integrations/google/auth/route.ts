import { NextResponse } from "next/server";
import { getGoogleOAuthUrl } from "@/lib/integrations/google";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const { url } = getGoogleOAuthUrl(user?.id);
    return NextResponse.redirect(url);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to start OAuth";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
