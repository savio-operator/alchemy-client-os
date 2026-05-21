import { NextResponse } from "next/server";
import { listIntegrations, deleteIntegrationTokens } from "@/lib/integration-store";

export async function GET() {
  try {
    const integrations = listIntegrations();
    return NextResponse.json(integrations);
  } catch {
    // DB_KEY not set — return all disconnected
    return NextResponse.json(
      ["meta", "x", "linkedin", "google", "razorpay"].map((p) => ({
        provider: p,
        connected: false,
      }))
    );
  }
}

export async function DELETE(request: Request) {
  const { provider } = await request.json();
  if (!provider) {
    return NextResponse.json({ error: "Provider required" }, { status: 400 });
  }
  deleteIntegrationTokens(provider);
  return NextResponse.json({ success: true });
}
