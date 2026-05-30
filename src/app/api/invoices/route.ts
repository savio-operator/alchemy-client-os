import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices, invoiceItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const conditions = [];
  if (status) conditions.push(eq(invoices.status, status));
  if (clientId) conditions.push(eq(invoices.clientId, clientId));

  let rows;
  if (conditions.length > 0) {
    rows = await db
      .select()
      .from(invoices)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .all();
  } else {
    rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).all();
  }

  // Fetch items for each invoice
  const result = await Promise.all(
    rows.map(async (inv) => {
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id))
        .all();
      return { ...inv, items };
    })
  );

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const {
    clientId,
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

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!number || typeof number !== "string" || !number.trim()) {
    return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
  }

  // Calculate amount from items if provided, otherwise use direct amount
  let calculatedAmount: number;
  if (Array.isArray(items) && items.length > 0) {
    calculatedAmount = items.reduce((sum: number, item: { quantity?: number; rate: number }) => {
      const qty = item.quantity ?? 1;
      return sum + qty * item.rate;
    }, 0);
  } else if (amount != null && !isNaN(parseFloat(amount))) {
    calculatedAmount = parseFloat(amount);
  } else {
    return NextResponse.json({ error: "Amount or items are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const invoiceId = crypto.randomUUID();
  const invoice = {
    id: invoiceId,
    clientId,
    number: number.trim(),
    amount: calculatedAmount,
    currency: currency || "INR",
    status: "draft",
    dueDate: dueDate || null,
    paidAt: null,
    description: description || null,
    taxPercent: taxPercent ?? 0,
    discountAmount: discountAmount ?? 0,
    notes: notes || null,
    fromName: fromName || null,
    fromAddress: fromAddress || null,
    fromGst: fromGst || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(invoices).values(invoice).run();

  // Insert items if provided
  const insertedItems = [];
  if (Array.isArray(items) && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = item.quantity ?? 1;
      const itemRecord = {
        id: crypto.randomUUID(),
        invoiceId,
        description: item.description,
        quantity: qty,
        rate: item.rate,
        amount: qty * item.rate,
        sortOrder: i,
      };
      await db.insert(invoiceItems).values(itemRecord).run();
      insertedItems.push(itemRecord);
    }
  }

  return NextResponse.json({ ...invoice, items: insertedItems }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const {
    id,
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

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (status !== undefined) {
    updates.status = status;
    if (status === "paid") updates.paidAt = new Date().toISOString();
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
