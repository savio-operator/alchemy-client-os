import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { invoices } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { clientId, number, amount, currency, dueDate, description } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!number || typeof number !== "string" || !number.trim()) {
    return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
  }
  if (amount == null || isNaN(parseFloat(amount))) {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const invoice = {
    id: crypto.randomUUID(),
    clientId,
    number: number.trim(),
    amount: parseFloat(amount),
    currency: currency || "INR",
    status: "draft",
    dueDate: dueDate || null,
    paidAt: null,
    description: description || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(invoices).values(invoice).run();

  return NextResponse.json(invoice, { status: 201 });
}
