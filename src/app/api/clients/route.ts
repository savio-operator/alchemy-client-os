import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientProfile, clientBrief } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const allClients = await db.select().from(clients).all();
  return NextResponse.json(allClients);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, industry, stage, profile, brief } = body as {
    name: string;
    industry?: string;
    stage?: string;
    profile?: Record<string, unknown>;
    brief?: {
      summaryMd?: string;
      northStar?: string;
      audience?: string;
      voice?: string;
      constraints?: string;
    };
  };

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  let slug = slugify(name);

  // Ensure unique slug
  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .get();
  if (existing) {
    slug = `${slug}-${id.slice(0, 6)}`;
  }

  await db.insert(clients)
    .values({
      id,
      name,
      slug,
      industry: industry || null,
      stage: stage || null,
      createdAt: new Date().toISOString(),
    })
    .run();

  if (profile) {
    await db.insert(clientProfile)
      .values({ clientId: id, rawJson: JSON.stringify(profile) })
      .run();
  }

  if (brief) {
    await db.insert(clientBrief)
      .values({
        clientId: id,
        summaryMd: brief.summaryMd || null,
        northStar: brief.northStar || null,
        audience: brief.audience || null,
        voice: brief.voice || null,
        constraints: brief.constraints || null,
      })
      .run();
  }

  const created = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .get();

  return NextResponse.json(created, { status: 201 });
}
