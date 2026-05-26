const isDisabled = process.env.AI_DISABLED === "1";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Models to try in order — each has its own separate free-tier quota
const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

async function callGeminiModel(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
      }),
    }
  );

  if (res.status === 429) return null; // quota exhausted, try next model
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: {
    maxTokens?: number;
    model?: string;
  }
): Promise<string> {
  if (isDisabled) {
    return "[AI disabled] Placeholder response — AI_DISABLED=1";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please add it to your environment variables."
    );
  }

  const modelsToTry = options?.model ? [options.model] : MODELS;

  for (const model of modelsToTry) {
    const result = await callGeminiModel(model, apiKey, systemPrompt, userMessage);
    if (result) return result;
  }

  throw new Error(
    "All Gemini models rate-limited. Free tier daily quota exhausted — resets tomorrow."
  );
}
