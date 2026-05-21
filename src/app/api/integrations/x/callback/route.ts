import { NextResponse } from "next/server";
import { exchangeXCode } from "@/lib/integrations/x";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, appUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=Missing+code+or+state", appUrl)
    );
  }

  try {
    await exchangeXCode(code, state);
    return NextResponse.redirect(new URL("/settings?connected=x", appUrl));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
