import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const convos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.clientId, clientId))
    .orderBy(desc(conversations.updatedAt))
    .all();

  return NextResponse.json(convos);
}
