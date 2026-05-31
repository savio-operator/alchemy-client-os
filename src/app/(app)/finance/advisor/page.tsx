"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/finance/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.message }]);
    } catch {
      setMessages([...updatedMessages, { role: "assistant", content: "Error: Failed to get a response." }]);
    }

    setLoading(false);
  };

  const quickQuestions = [
    "Can we afford to pay all salaries this month?",
    "Project our year-end financial position",
    "Which months look risky based on current data?",
    "Where can we cut costs?",
    "What if our income drops by 30%?",
    "Give me a monthly financial summary",
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold">AI Advisor</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-0.5">Financial insights powered by AI</p>
        </div>
        <button
          onClick={() => setMessages([])}
          disabled={messages.length === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)] transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-[var(--radius)] bg-[var(--accent-clay)]/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-[var(--accent-clay)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-semibold">Ask me anything about your finances</h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1 max-w-md">
              I have access to all your financial data and can provide insights, projections, and recommendations.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 max-w-lg justify-center">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs rounded-full border border-[var(--rule)] text-[var(--ink-muted)] hover:border-[var(--accent-clay)] hover:text-[var(--accent-clay)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-[var(--radius)] px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--accent-clay)] text-white"
                  : "border border-[var(--rule)] bg-[var(--surface)]"
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="border border-[var(--rule)] bg-[var(--surface)] rounded-[var(--radius)] px-4 py-3 text-sm text-[var(--ink-muted)]">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3 pt-3 border-t border-[var(--rule)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your finances..."
            className="flex-1 text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-3 py-2 bg-transparent outline-none focus:border-[var(--accent-clay)]"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="h-9 px-4 rounded-[var(--radius-sm)] bg-[var(--accent-clay)] text-white text-sm font-medium hover:bg-[var(--accent-clay)]/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
