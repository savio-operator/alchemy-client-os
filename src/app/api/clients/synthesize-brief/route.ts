import { NextResponse } from "next/server";
import { callAI } from "@/lib/anthropic";

const SYSTEM_PROMPT = `You are a senior brand strategist. Given raw questionnaire answers from a client onboarding, synthesize them into a structured brief.

Return a JSON object with exactly these fields:
- "summaryMd": A 2-3 paragraph markdown summary of the client, their business, goals, and current situation. Write in third person.
- "northStar": One clear sentence defining what success looks like for this client in 12 months.
- "audience": A concise description of the target customer/audience.
- "voice": The brand voice and tone guidelines (2-3 sentences).
- "constraints": Any constraints, budget limitations, or things to avoid.

Be specific and actionable. Reference the actual answers given. Do not add information that wasn't provided.
Return ONLY the JSON object, no markdown code blocks.`;

export async function POST(request: Request) {
  const body = await request.json();
  const { answers } = body as { answers: Record<string, unknown> };

  if (!answers) {
    return NextResponse.json({ error: "Answers required" }, { status: 400 });
  }

  try {
    const result = await callAI(
      SYSTEM_PROMPT,
      `Here are the raw questionnaire answers:\n\n${JSON.stringify(answers, null, 2)}`
    );

    const brief = JSON.parse(result);
    return NextResponse.json(brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI synthesis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
