import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  filePath: string;
}

const AGENTS_DIR = path.join(process.cwd(), "agents");

export function loadAgents(): AgentConfig[] {
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const filePath = path.join(AGENTS_DIR, f);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      return {
        name: data.name || f.replace(".md", ""),
        description: data.description || "",
        model: data.model || "claude-sonnet-4-6",
        tools: data.tools || [],
        systemPrompt: content.trim(),
        filePath: f,
      };
    });
}

export function getAgent(name: string): AgentConfig | null {
  const agents = loadAgents();
  return agents.find((a) => a.name === name) || null;
}

export function saveAgent(fileName: string, content: string): void {
  const filePath = path.join(AGENTS_DIR, fileName);
  fs.writeFileSync(filePath, content, "utf-8");
}

export function deleteAgent(fileName: string): void {
  const filePath = path.join(AGENTS_DIR, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
