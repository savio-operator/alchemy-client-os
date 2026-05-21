import { NextResponse } from "next/server";
import { startDiscoveryEngine } from "@/lib/discovery-engine";

export async function POST() {
  startDiscoveryEngine();
  return NextResponse.json({ started: true });
}
