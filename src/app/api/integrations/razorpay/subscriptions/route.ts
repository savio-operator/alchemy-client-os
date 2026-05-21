import { NextResponse } from "next/server";
import { listSubscriptions, getSubscription, listInvoices } from "@/lib/integrations/razorpay";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "list";
  const subscriptionId = url.searchParams.get("subscriptionId");

  try {
    if (action === "get" && subscriptionId) {
      const subscription = await getSubscription(subscriptionId);
      return NextResponse.json({ subscription });
    }

    if (action === "invoices") {
      const count = parseInt(url.searchParams.get("count") || "20");
      const skip = parseInt(url.searchParams.get("skip") || "0");
      const invoices = await listInvoices({ count, skip });
      return NextResponse.json(invoices);
    }

    // Default: list subscriptions
    const subscriptions = await listSubscriptions();
    return NextResponse.json(subscriptions);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Razorpay request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
