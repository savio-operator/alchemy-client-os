import { NextResponse } from "next/server";
import { db, initPromise } from "@/db";
import { campaigns } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initPromise;

  const body = await request.json().catch(() => ({}));
  const { clientId, type, objective, channel, budget, startDate, endDate } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const campaign = {
    id: crypto.randomUUID(),
    clientId,
    type,
    objective: objective || null,
    channel: channel || null,
    hypothesis: null,
    creativeNotes: null,
    budget: budget ? parseFloat(budget) : null,
    startDate: startDate || null,
    endDate: endDate || null,
    kpi: null,
    outcome: null,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(campaigns).values(campaign).run();

  return NextResponse.json(campaign, { status: 201 });
}
