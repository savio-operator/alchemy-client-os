import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    node: process.version,
    time: new Date().toISOString(),
    env: {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? "set" : "unset",
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "set" : "unset",
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
