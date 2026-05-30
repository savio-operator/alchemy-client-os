import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices, invoiceItems, clients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { id } = await params;

  const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .all();

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .get();

  return NextResponse.json({ ...invoice, items, client: client || null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "founder" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initPromise;

  const { id } = await params;

  const existing = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  await db.delete(invoices).where(eq(invoices.id, id)).run();

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const {
    status,
    number,
    amount,
    currency,
    dueDate,
    description,
    taxPercent,
    discountAmount,
    notes,
    fromName,
    fromAddress,
    fromGst,
    items,
  } = body;

  const existing = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (status !== undefined) {
    // Validate status transitions
    if (status === "sent" && existing.status !== "draft") {
      return NextResponse.json({ error: "Can only send draft invoices" }, { status: 400 });
    }
    updates.status = status;
    if (status === "paid") {
      updates.paidAt = new Date().toISOString();
    }
  }
  if (number !== undefined) updates.number = number;
  if (currency !== undefined) updates.currency = currency;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (description !== undefined) updates.description = description;
  if (taxPercent !== undefined) updates.taxPercent = taxPercent;
  if (discountAmount !== undefined) updates.discountAmount = discountAmount;
  if (notes !== undefined) updates.notes = notes;
  if (fromName !== undefined) updates.fromName = fromName;
  if (fromAddress !== undefined) updates.fromAddress = fromAddress;
  if (fromGst !== undefined) updates.fromGst = fromGst;

  // If items provided, delete existing and re-insert, recalculate amount
  if (Array.isArray(items)) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();

    let calculatedAmount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = item.quantity ?? 1;
      const itemAmount = qty * item.rate;
      calculatedAmount += itemAmount;
      await db.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        description: item.description,
        quantity: qty,
        rate: item.rate,
        amount: itemAmount,
        sortOrder: i,
      }).run();
    }
    updates.amount = calculatedAmount;
  } else if (amount !== undefined) {
    updates.amount = amount;
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, id)).run();

  const updated = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  const updatedItems = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .all();

  return NextResponse.json({ ...updated, items: updatedItems });
}
