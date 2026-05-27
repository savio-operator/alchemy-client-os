import { NextResponse } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const mems = await db
    .select()
    .from(memories)
    .where(eq(memories.clientId, clientId))
    .all();

  return NextResponse.json(mems);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(memories).where(eq(memories.id, id)).run();
  return NextResponse.json({ success: true });
}
