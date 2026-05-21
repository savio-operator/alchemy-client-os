import Anthropic from "@anthropic-ai/sdk";

const isDisabled = process.env.AI_DISABLED === "1";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
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
    throw new Error("AI is disabled via AI_DISABLED=1");
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: options?.model ?? "claude-sonnet-4-6",
    max_tokens: options?.maxTokens ?? 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }
  return textBlock.text;
}
