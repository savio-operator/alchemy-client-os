import { NextResponse } from "next/server";
import { loadSources } from "@/lib/sources";

export async function GET() {
  const sources = loadSources();
  return NextResponse.json(sources);
}
