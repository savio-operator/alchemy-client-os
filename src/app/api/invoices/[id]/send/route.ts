import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices, invoiceItems, clients, settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { to, subject, message } = body as { to: string; subject?: string; message?: string };

  if (!to || typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 503 });
  }

  // Fetch invoice data
  const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).all();
  const client = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).get();

  // Get business info
  const fromEmail = process.env.RESEND_FROM_EMAIL || "invoices@resend.dev";

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const taxAmount = subtotal * ((invoice.taxPercent || 0) / 100);
  const total = subtotal + taxAmount - (invoice.discountAmount || 0);

  // Build HTML email
  const itemRows = items
    .map(
      (item, i) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 8px; font-size: 14px;">${i + 1}</td>
        <td style="padding: 10px 8px; font-size: 14px;">${item.description}</td>
        <td style="padding: 10px 8px; font-size: 14px; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px 8px; font-size: 14px; text-align: right;">${formatCurrency(item.rate, invoice.currency)}</td>
        <td style="padding: 10px 8px; font-size: 14px; text-align: right; font-weight: 600;">${formatCurrency(item.quantity * item.rate, invoice.currency)}</td>
      </tr>`
    )
    .join("");

  const dueDateStr = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Check if there's a payment link stored
  const paymentLinkSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `payment_link_${id}`))
    .get();
  const paymentLink = paymentLinkSetting?.value;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">

  ${message ? `<p style="font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${message}</p><hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">` : ""}

  <div style="margin-bottom: 24px;">
    ${invoice.fromName ? `<h2 style="margin: 0 0 4px; font-size: 20px;">${invoice.fromName}</h2>` : ""}
    ${invoice.fromAddress ? `<p style="margin: 0; font-size: 13px; color: #666; white-space: pre-line;">${invoice.fromAddress}</p>` : ""}
    ${invoice.fromGst ? `<p style="margin: 4px 0 0; font-size: 13px; color: #666;">GST: ${invoice.fromGst}</p>` : ""}
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
    <div>
      <p style="font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 4px;">Bill To</p>
      <p style="margin: 0; font-weight: 600;">${client?.name || "Client"}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 24px; font-weight: 700; color: #999; margin: 0;">INVOICE</p>
      <p style="font-size: 13px; color: #666; margin: 4px 0 0;">#${invoice.number}</p>
      <p style="font-size: 13px; color: #666; margin: 2px 0 0;">Date: ${new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
      ${dueDateStr ? `<p style="font-size: 13px; color: #666; margin: 2px 0 0;">Due: ${dueDateStr}</p>` : ""}
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="border-bottom: 2px solid #ddd;">
        <th style="text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #999;">#</th>
        <th style="text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #999;">Description</th>
        <th style="text-align: right; padding: 8px; font-size: 11px; text-transform: uppercase; color: #999;">Qty</th>
        <th style="text-align: right; padding: 8px; font-size: 11px; text-transform: uppercase; color: #999;">Rate</th>
        <th style="text-align: right; padding: 8px; font-size: 11px; text-transform: uppercase; color: #999;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="text-align: right; margin-bottom: 24px;">
    <p style="font-size: 14px; margin: 4px 0;"><span style="color: #666;">Subtotal:</span> ${formatCurrency(subtotal, invoice.currency)}</p>
    ${(invoice.taxPercent || 0) > 0 ? `<p style="font-size: 14px; margin: 4px 0;"><span style="color: #666;">Tax (${invoice.taxPercent}%):</span> ${formatCurrency(taxAmount, invoice.currency)}</p>` : ""}
    ${(invoice.discountAmount || 0) > 0 ? `<p style="font-size: 14px; margin: 4px 0;"><span style="color: #666;">Discount:</span> -${formatCurrency(invoice.discountAmount || 0, invoice.currency)}</p>` : ""}
    <p style="font-size: 18px; font-weight: 700; margin: 8px 0 0; padding-top: 8px; border-top: 2px solid #333;">Total: ${formatCurrency(total, invoice.currency)}</p>
  </div>

  ${paymentLink ? `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${paymentLink}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Pay Now</a>
  </div>` : ""}

  ${invoice.notes ? `
  <div style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px;">
    <p style="font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 4px;">Notes / Terms</p>
    <p style="font-size: 13px; color: #666; white-space: pre-line;">${invoice.notes}</p>
  </div>` : ""}

  <p style="text-align: center; font-size: 12px; color: #999; margin-top: 32px;">Thank you for your business</p>
</body>
</html>`;

  // Send email
  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject || `Invoice ${invoice.number} from ${invoice.fromName || "Adchemy"}`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update invoice status to sent if it's draft
    if (invoice.status === "draft") {
      await db
        .update(invoices)
        .set({ status: "sent", updatedAt: new Date().toISOString() })
        .where(eq(invoices.id, id))
        .run();
    }

    return NextResponse.json({ success: true, status: "sent" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
