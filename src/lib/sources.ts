import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface SourceConfig {
  name: string;
  type: string;
  config: Record<string, unknown>;
  pollMinutes: number;
  tags: string[];
  description: string;
}

const SOURCES_DIR = path.join(process.cwd(), "sources");

export function loadSources(): SourceConfig[] {
  if (!fs.existsSync(SOURCES_DIR)) return [];

  return fs
    .readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(SOURCES_DIR, f), "utf-8");
      const { data, content } = matter(raw);
      return {
        name: data.name || f.replace(".md", ""),
        type: data.type || "unknown",
        config: data.config || {},
        pollMinutes: data.poll_minutes || 360,
        tags: data.tags || [],
        description: content.trim(),
      };
    });
}

export function getSource(name: string): SourceConfig | null {
  const sources = loadSources();
  return sources.find((s) => s.name === name) || null;
}
