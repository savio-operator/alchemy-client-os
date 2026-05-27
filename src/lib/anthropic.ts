const isDisabled = process.env.AI_DISABLED === "1";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Models to try in order — each has its own separate free-tier quota
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

async function callGeminiRaw(
  model: string,
  apiKey: string,
  systemPrompt: string,
  contents: GeminiContent[]
): Promise<string | null> {
  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
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

async function callGeminiModel(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  return callGeminiRaw(model, apiKey, systemPrompt, [
    { role: "user", parts: [{ text: userMessage }] },
  ]);
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

  // Only use the requested model if it's a valid Gemini model; otherwise use defaults
  const isGeminiModel = options?.model?.startsWith("gemini-") ?? false;
  const modelsToTry = isGeminiModel ? [options!.model!] : MODELS;

  for (const model of modelsToTry) {
    const result = await callGeminiModel(model, apiKey, systemPrompt, userMessage);
    if (result) return result;
  }

  throw new Error(
    "All Gemini models rate-limited. Free tier daily quota exhausted — resets tomorrow."
  );
}

// Multi-turn chat version
export async function callAIChat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  if (isDisabled) {
    return "[AI disabled] Placeholder response — AI_DISABLED=1";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  // Convert to Gemini format (assistant → model), cap at last 20 messages
  const recent = messages.slice(-20);
  const contents: GeminiContent[] = recent.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (const model of MODELS) {
    const result = await callGeminiRaw(model, apiKey, systemPrompt, contents);
    if (result) return result;
  }

  throw new Error(
    "All Gemini models rate-limited. Free tier daily quota exhausted — resets tomorrow."
  );
}
