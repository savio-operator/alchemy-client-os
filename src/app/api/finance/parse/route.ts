import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAI } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ entries: [] });

  const systemPrompt = `You are a financial data extractor for a digital agency called Adchemy.
Extract structured financial entries from raw text (bank messages, notes, invoices).
Return a JSON array of objects with these fields:
- date: string (YYYY-MM-DD format)
- type: "income" or "expense"
- description: string
- category: string (e.g. "Client Payment", "Software", "Office", "Marketing", "Salary", "Freelancer", "Tax", "Other")
- amount: number (positive value)
- client: string (client name if applicable, empty string otherwise)

Only return the JSON array, nothing else. If you can't extract any entries, return an empty array [].`;

  const result = await callAI(systemPrompt, `Extract financial entries from this text:\n\n${text}`);

  try {
    let jsonStr = result.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    const entries = JSON.parse(jsonStr);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [], raw: result });
  }
}
