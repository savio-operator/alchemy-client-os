"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Send, Loader2 } from "lucide-react";
import { useDrawer } from "@/store/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface AgentOption {
  name: string;
  description: string;
}

interface RunResult {
  role: "user" | "agent";
  content: string;
  agentName?: string;
}

export function AgentDrawer() {
  const { open, setOpen } = useDrawer();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<RunResult[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then((data) => {
          setAgents(data);
          if (data.length > 0 && !selectedAgent) {
            setSelectedAgent(data[0].name);
          }
        });
    }
  }, [open, selectedAgent]);

  const handleRun = async () => {
    if (!input.trim() || !selectedAgent || running) return;

    const userMessage = input.trim();
    setHistory((h) => [...h, { role: "user", content: userMessage }]);
    setInput("");
    setRunning(true);

    try {
      // Get client ID if we're on a client page
      let clientId = "";
      if (slug) {
        const clientRes = await fetch(`/api/clients/${slug}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          clientId = clientData.id;
        }
      }

      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: selectedAgent,
          clientId: clientId || "global",
          input: userMessage,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setHistory((h) => [
          ...h,
          { role: "agent", content: `Error: ${err.error}`, agentName: selectedAgent },
        ]);
      } else {
        const data = await res.json();
        setHistory((h) => [
          ...h,
          { role: "agent", content: data.output, agentName: selectedAgent },
        ]);
      }
    } catch {
      setHistory((h) => [
        ...h,
        { role: "agent", content: "Connection error", agentName: selectedAgent },
      ]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-[400px] h-full border-l border-[var(--rule)] bg-[var(--surface)] flex flex-col shrink-0"
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--rule)]">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <span className="text-sm font-medium">Agent Runner</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
              aria-label="Close agent runner"
            >
              <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          </div>

          {/* Agent picker */}
          <div className="px-4 py-3 border-b border-[var(--rule)]">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full h-8 px-2 text-sm bg-[var(--bg)] border border-[var(--rule)] rounded-[var(--radius-sm)]"
            >
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} — {a.description}
                </option>
              ))}
              {agents.length === 0 && (
                <option value="">No agents available</option>
              )}
            </select>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mb-4">
                  <Bot className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium mb-1">Ready to run</p>
                <p className="text-xs text-[var(--ink-muted)] max-w-[240px]">
                  Select an agent and send a message. Attach context by describing what you need analyzed.
                </p>
              </div>
            ) : (
              history.map((msg, i) => (
                <div
                  key={i}
                  className={`${
                    msg.role === "user" ? "ml-8" : "mr-4"
                  }`}
                >
                  {msg.role === "agent" && (
                    <p className="text-[10px] text-[var(--ink-muted)] mb-1 font-mono">
                      {msg.agentName}
                    </p>
                  )}
                  <div
                    className={`text-sm rounded-[var(--radius-sm)] p-3 ${
                      msg.role === "user"
                        ? "bg-[var(--accent-clay)]/10 text-[var(--ink)]"
                        : "bg-[var(--muted)]"
                    }`}
                  >
                    <div className="whitespace-pre-wrap prose-measure text-sm [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            {running && (
              <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running {selectedAgent}...
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[var(--rule)]">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleRun();
                  }
                }}
                placeholder="Describe what you need analyzed..."
                rows={2}
                className="text-sm flex-1 resize-none"
                disabled={running || agents.length === 0}
              />
              <Button
                size="sm"
                onClick={handleRun}
                disabled={running || !input.trim() || agents.length === 0}
                className="self-end bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-[var(--ink-muted)] mt-1">
              Cmd+Enter to send
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
