import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices, clients, settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import Razorpay from "razorpay";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 503 }
    );
  }

  const { id } = await params;

  const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const client = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).get();

  // Check if we already have a payment link
  const existingLink = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `payment_link_${id}`))
    .get();

  if (existingLink) {
    return NextResponse.json({ paymentLink: existingLink.value });
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  // Map currency — Razorpay uses paise for INR
  const currencyMap: Record<string, number> = { INR: 100, USD: 100, EUR: 100 };
  const multiplier = currencyMap[invoice.currency] || 100;
  const amountInSmallest = Math.round(invoice.amount * multiplier);

  try {
    const link = await razorpay.paymentLink.create({
      amount: amountInSmallest,
      currency: invoice.currency,
      description: `Invoice ${invoice.number}${client ? ` — ${client.name}` : ""}`,
      customer: {
        name: client?.name || "Customer",
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        invoice_id: id,
        invoice_number: invoice.number,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/invoices/${id}`,
      callback_method: "get",
    });

    const paymentLink = link.short_url;

    // Store payment link
    await db.insert(settings).values({
      key: `payment_link_${id}`,
      value: paymentLink,
    }).run();

    return NextResponse.json({ paymentLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { id } = await params;

  const existingLink = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `payment_link_${id}`))
    .get();

  return NextResponse.json({
    paymentLink: existingLink?.value || null,
  });
}
