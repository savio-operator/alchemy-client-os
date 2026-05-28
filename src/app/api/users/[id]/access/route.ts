import { NextResponse } from "next/server";
import { db } from "@/db";
import { userClientAccess } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "founder" && user.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const access = await db
    .select()
    .from(userClientAccess)
    .where(eq(userClientAccess.userId, id))
    .all();

  return NextResponse.json(access);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { clientId, accessLevel } = body as { clientId: string; accessLevel: string };

  if (!clientId || !accessLevel) {
    return NextResponse.json({ error: "clientId and accessLevel required" }, { status: 400 });
  }

  // Upsert
  const existing = await db
    .select()
    .from(userClientAccess)
    .where(and(eq(userClientAccess.userId, id), eq(userClientAccess.clientId, clientId)))
    .get();

  if (existing) {
    await db
      .update(userClientAccess)
      .set({ accessLevel })
      .where(and(eq(userClientAccess.userId, id), eq(userClientAccess.clientId, clientId)))
      .run();
  } else {
    await db
      .insert(userClientAccess)
      .values({
        userId: id,
        clientId,
        accessLevel,
        assignedBy: user.id,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  await db
    .delete(userClientAccess)
    .where(and(eq(userClientAccess.userId, id), eq(userClientAccess.clientId, clientId)))
    .run();

  return NextResponse.json({ success: true });
}
