import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/integrations/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, appUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=Missing+authorization+code", appUrl)
    );
  }

  try {
    await exchangeGoogleCode(code);
    return NextResponse.redirect(new URL("/settings?connected=google", appUrl));
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
