import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientBrief, clientProfile } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brief = await db
    .select()
    .from(clientBrief)
    .where(eq(clientBrief.clientId, client.id))
    .get();

  const profile = await db
    .select()
    .from(clientProfile)
    .where(eq(clientProfile.clientId, client.id))
    .get();

  return NextResponse.json({ ...client, brief, profile });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { brief: briefData, ...clientData } = body;

  if (Object.keys(clientData).length > 0) {
    await db.update(clients)
      .set(clientData)
      .where(eq(clients.id, client.id))
      .run();
  }

  if (briefData) {
    await db.insert(clientBrief)
      .values({ clientId: client.id, ...briefData })
      .onConflictDoUpdate({
        target: clientBrief.clientId,
        set: briefData,
      })
      .run();
  }

  return NextResponse.json({ success: true });
}
