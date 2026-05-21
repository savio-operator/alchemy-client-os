import { NextResponse } from "next/server";
import { exchangeMetaCode } from "@/lib/integrations/meta";

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
      new URL("/settings?error=No+authorization+code", appUrl)
    );
  }

  try {
    await exchangeMetaCode(code);
    return NextResponse.redirect(new URL("/settings?connected=meta", appUrl));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
