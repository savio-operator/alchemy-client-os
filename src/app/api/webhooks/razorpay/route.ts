import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await initPromise;

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const signature = request.headers.get("x-razorpay-signature");
    const body = await request.text();

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    return handleEvent(event);
  }

  // Without webhook secret, still process but no verification
  const event = await request.json();
  return handleEvent(event);
}

async function handleEvent(event: { event: string; payload: { payment_link?: { entity: { notes?: { invoice_id?: string }; status?: string } }; payment?: { entity: { notes?: { invoice_id?: string }; status?: string } } } }) {
  const eventType = event.event;

  if (eventType === "payment_link.paid" || eventType === "payment.captured") {
    const entity =
      event.payload.payment_link?.entity || event.payload.payment?.entity;
    const invoiceId = entity?.notes?.invoice_id;

    if (invoiceId) {
      const invoice = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .get();

      if (invoice && invoice.status !== "paid") {
        await db
          .update(invoices)
          .set({
            status: "paid",
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(invoices.id, invoiceId))
          .run();
      }
    }
  }

  return NextResponse.json({ success: true });
}
