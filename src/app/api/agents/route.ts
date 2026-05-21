import { NextResponse } from "next/server";
import { loadAgents, saveAgent } from "@/lib/agents";

export async function GET() {
  const agents = loadAgents();
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { fileName, content } = body as { fileName: string; content: string };

  if (!fileName || !content) {
    return NextResponse.json({ error: "fileName and content required" }, { status: 400 });
  }

  const safeName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  saveAgent(safeName, content);
  return NextResponse.json({ success: true, fileName: safeName }, { status: 201 });
}
