import { NextResponse } from "next/server";
import { getAgent, saveAgent, deleteAgent } from "@/lib/agents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const agent = getAgent(name);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const body = await request.json();
  const { content } = body as { content: string };

  const agent = getAgent(name);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  saveAgent(agent.filePath, content);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const agent = getAgent(name);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  deleteAgent(agent.filePath);
  return NextResponse.json({ success: true });
}
