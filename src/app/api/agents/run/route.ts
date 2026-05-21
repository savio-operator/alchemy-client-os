import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { getAgent } from "@/lib/agents";
import { callAI } from "@/lib/anthropic";
import crypto from "crypto";

export async function POST(request: Request) {
  const body = await request.json();
  const { agentName, clientId, input } = body as {
    agentName: string;
    clientId: string;
    input: string;
  };

  const agent = getAgent(agentName);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const output = await callAI(agent.systemPrompt, input, {
      model: agent.model,
    });

    const id = crypto.randomUUID();
    db.insert(agentRuns)
      .values({
        id,
        clientId,
        agentName,
        inputJson: JSON.stringify({ input }),
        outputMd: output,
        createdAt: new Date().toISOString(),
      })
      .run();

    return NextResponse.json({ id, output });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
