import { NextResponse } from "next/server";
import { listPayments, getPayment, getRevenueSummary } from "@/lib/integrations/razorpay";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "list";
  const paymentId = url.searchParams.get("paymentId");

  try {
    if (action === "get" && paymentId) {
      const payment = await getPayment(paymentId);
      return NextResponse.json({ payment });
    }

    if (action === "summary") {
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      const summary = await getRevenueSummary(
        fromParam ? new Date(fromParam) : undefined,
        toParam ? new Date(toParam) : undefined
      );
      return NextResponse.json(summary);
    }

    // Default: list
    const count = parseInt(url.searchParams.get("count") || "20");
    const skip = parseInt(url.searchParams.get("skip") || "0");
    const payments = await listPayments({ count, skip });
    return NextResponse.json(payments);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Razorpay request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
