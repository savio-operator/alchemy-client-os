"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare, Plus, ChevronLeft } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

export default function AdvisorPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    fetch("/api/finance/advisor/conversations")
      .then((r) => r.json())
      .then((data) => {
        setConversations(data);
        if (data.length > 0) {
          loadConversation(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    const res = await fetch(`/api/finance/advisor/conversations/${id}`);
    const data = await res.json();
    setMessages(
      (data.messages || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );
  };

  const startNewConversation = async () => {
    const res = await fetch("/api/finance/advisor/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New conversation" }),
    });
    const conv = await res.json();
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/finance/advisor/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // If no active conversation, create one
    let convId = activeConvId;
    if (!convId) {
      const res = await fetch("/api/finance/advisor/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.trim().slice(0, 50) }),
      });
      const conv = await res.json();
      setConversations((prev) => [conv, ...prev]);
      convId = conv.id;
      setActiveConvId(conv.id);
    }

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/finance/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, conversationId: convId }),
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
    <div className="flex gap-4" style={{ height: "calc(100vh - 12rem)" }}>
      {/* Conversation sidebar */}
      {showSidebar && (
        <div className="w-56 shrink-0 border-r border-[var(--rule)] pr-3 flex flex-col hidden md:flex">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--ink-muted)] uppercase">History</span>
            <button
              onClick={startNewConversation}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)]"
              title="New conversation"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={2} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-1 rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
                  activeConvId === conv.id ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"
                }`}
              >
                <button
                  onClick={() => loadConversation(conv.id)}
                  className="flex-1 text-left px-2 py-1.5 text-xs truncate"
                >
                  {conv.title || "Untitled"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 shrink-0 mr-1"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-[var(--ink-muted)] px-2 py-4">No conversations yet</p>
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-8 h-8 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors hidden md:flex"
            >
              <ChevronLeft className={`w-4 h-4 text-[var(--ink-muted)] transition-transform ${showSidebar ? "" : "rotate-180"}`} strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-2xl font-serif font-semibold">AI Advisor</h1>
              <p className="text-sm text-[var(--ink-muted)] mt-0.5">Financial insights powered by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewConversation}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm border border-[var(--rule)] hover:bg-[var(--muted)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
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
                I have access to all your financial data, invoices, and client information.
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
    </div>
  );
}
