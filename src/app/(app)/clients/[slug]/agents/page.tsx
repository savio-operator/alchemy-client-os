"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Plus, Trash2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useDrawer } from "@/store/drawer";

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  filePath: string;
}

const AGENT_TEMPLATE = `---
name: my-agent
description: Describe what this agent does
model: claude-sonnet-4-6
tools: []
---
You are a helpful analysis agent. Given context about a client, you provide structured insights.

Your job is to analyze, not to generate marketing copy. Always base your analysis on the data provided.
`;

export default function AgentsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newContent, setNewContent] = useState(AGENT_TEMPLATE);
  const [newFileName, setNewFileName] = useState("");
  const [viewingAgent, setViewingAgent] = useState<AgentConfig | null>(null);
  const { setOpen: openDrawer } = useDrawer();

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: newFileName.trim(),
        content: newContent,
      }),
    });
    setCreating(false);
    setNewFileName("");
    setNewContent(AGENT_TEMPLATE);
    fetchAgents();
  };

  const handleDelete = async (name: string) => {
    await fetch(`/api/agents/${name}`, { method: "DELETE" });
    fetchAgents();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-serif">Agents</h1>
        <Button
          size="sm"
          onClick={() => setCreating(!creating)}
          className="gap-1 bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          New agent
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5 space-y-3">
              <div>
                <label className="text-xs text-[var(--ink-muted)] mb-1 block">File name</label>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="my-agent.md"
                  className="text-sm font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ink-muted)] mb-1 block">Agent definition (frontmatter + system prompt)</label>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={12}
                  className="text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newFileName.trim()}
                  className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                >
                  Create agent
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Bot className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No agents defined</p>
          <p className="text-xs text-[var(--ink-muted)]">
            Create an agent by adding a markdown file with frontmatter.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="group rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {agent.model}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] mb-2">
                    {agent.description}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] font-mono">
                    {agent.filePath}
                  </p>
                </div>

                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-120">
                  <button
                    onClick={() => setViewingAgent(viewingAgent?.name === agent.name ? null : agent)}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                    title="View source"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openDrawer(true)}
                  >
                    Run
                  </Button>
                  <button
                    onClick={() => handleDelete(agent.name)}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Source view */}
              {viewingAgent?.name === agent.name && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 pt-3 border-t border-[var(--rule)]"
                >
                  <pre className="text-xs font-mono bg-[var(--muted)] p-3 rounded-[var(--radius-sm)] overflow-x-auto whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </pre>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
