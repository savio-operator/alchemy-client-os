"use client";

import { useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bot,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  Pencil,
  Check,
} from "lucide-react";
import { useDrawer } from "@/store/drawer";
import { useChat } from "@/store/chat";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AgentDrawer() {
  const { open, setOpen } = useDrawer();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  const {
    activeConversationId,
    conversations,
    messages,
    showList,
    setActiveConversation,
    setConversations,
    setMessages,
    addMessage,
    addConversation,
    toggleList,
    setShowList,
    reset,
  } = useChat();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clientId, setClientId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut
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

  // Load client ID and conversations when drawer opens
  useEffect(() => {
    if (!open) return;

    if (!slug) {
      // Homepage — global mode
      setClientId("global");
      fetch(`/api/chat/conversations?clientId=global`)
        .then((r) => r.json())
        .then((convos) => setConversations(convos));
      return;
    }

    fetch(`/api/clients/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setClientId(data.id);
          fetch(`/api/chat/conversations?clientId=${data.id}`)
            .then((r) => r.json())
            .then((convos) => setConversations(convos));
        }
      });
  }, [open, slug, setConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/chat/conversations/${activeConversationId}`)
      .then((r) => r.json())
      .then((msgs) => setMessages(msgs));
  }, [activeConversationId, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !clientId) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistically add user message
    addMessage({
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || "",
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          conversationId: activeConversationId || undefined,
          message: userMessage,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        addMessage({
          id: `err-${Date.now()}`,
          conversationId: activeConversationId || "",
          role: "assistant",
          content: `Error: ${err.error || "Something went wrong"}`,
          createdAt: new Date().toISOString(),
        });
        setSending(false);
        return;
      }

      const data = await res.json();

      // If this was a new conversation, update state
      if (!activeConversationId) {
        setActiveConversation(data.conversationId);
        addConversation({
          id: data.conversationId,
          clientId,
          title: userMessage.slice(0, 60),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Add assistant response
      addMessage({
        id: `ai-${Date.now()}`,
        conversationId: data.conversationId,
        role: "assistant",
        content: data.message,
        toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      addMessage({
        id: `err-${Date.now()}`,
        conversationId: activeConversationId || "",
        role: "assistant",
        content: "Connection error. Please try again.",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  }, [
    input,
    sending,
    clientId,
    activeConversationId,
    addMessage,
    addConversation,
    setActiveConversation,
  ]);

  const handleNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    setShowList(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    setConversations(conversations.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      handleNewChat();
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setConversations(
      conversations.map((c) =>
        c.id === id ? { ...c, title: editTitle.trim() } : c
      )
    );
    setEditingId(null);
  };

  const visibleMessages = messages.filter((m) => m.role !== "tool_result");

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
              {showList ? (
                <button
                  onClick={() => setShowList(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                >
                  <ChevronLeft
                    className="w-4 h-4 text-[var(--ink-muted)]"
                    strokeWidth={1.5}
                  />
                </button>
              ) : (
                <button
                  onClick={toggleList}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                  title="Chat history"
                >
                  <MessageSquare
                    className="w-4 h-4 text-[var(--ink-muted)]"
                    strokeWidth={1.5}
                  />
                </button>
              )}
              <span className="text-sm font-medium">
                {showList ? "Chats" : "Chat"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                title="New chat"
              >
                <Plus
                  className="w-4 h-4 text-[var(--ink-muted)]"
                  strokeWidth={1.5}
                />
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                aria-label="Close chat"
              >
                <X
                  className="w-4 h-4 text-[var(--ink-muted)]"
                  strokeWidth={1.5}
                />
              </button>
            </div>
          </div>

          {showList ? (
            /* Conversation list */
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <MessageSquare
                    className="w-8 h-8 text-[var(--ink-muted)] mb-3"
                    strokeWidth={1}
                  />
                  <p className="text-sm text-[var(--ink-muted)]">
                    No previous chats
                  </p>
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between px-4 py-3 border-b border-[var(--rule)] cursor-pointer hover:bg-[var(--muted)] transition-colors ${
                      c.id === activeConversationId
                        ? "bg-[var(--muted)]"
                        : ""
                    }`}
                    onClick={() => {
                      if (editingId !== c.id) {
                        setActiveConversation(c.id);
                        setShowList(false);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      {editingId === c.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(c.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium w-full bg-transparent border-b border-[var(--accent-clay)] outline-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium truncate">
                          {c.title || "Untitled chat"}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--ink-muted)]">
                        {new Date(c.updatedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      {editingId === c.id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(c.id);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--rule)]"
                        >
                          <Check
                            className="w-3 h-3 text-green-600"
                            strokeWidth={2}
                          />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(c.id);
                            setEditTitle(c.title || "");
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--rule)]"
                        >
                          <Pencil
                            className="w-3 h-3 text-[var(--ink-muted)]"
                            strokeWidth={1.5}
                          />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(c.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--rule)]"
                      >
                        <Trash2
                          className="w-3 h-3 text-[var(--ink-muted)]"
                          strokeWidth={1.5}
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mb-4">
                      <Bot
                        className="w-5 h-5 text-[var(--ink-muted)]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <p className="text-sm font-medium mb-1">
                      Start a conversation
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] max-w-[240px]">
                      Ask anything — schedule meetings, add ideas, search
                      history, or just chat about strategy.
                    </p>
                  </div>
                ) : (
                  visibleMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={msg.role === "user" ? "ml-8" : "mr-4"}
                    >
                      {msg.role === "assistant" && (
                        <p className="text-[10px] text-[var(--ink-muted)] mb-1 font-mono">
                          adchemy
                        </p>
                      )}
                      <div
                        className={`text-sm rounded-[var(--radius-sm)] p-3 ${
                          msg.role === "user"
                            ? "bg-[var(--accent-clay)]/10 text-[var(--ink)]"
                            : "bg-[var(--muted)]"
                        }`}
                      >
                        <div className="whitespace-pre-wrap prose-measure text-sm">
                          {msg.content}
                        </div>
                        {msg.toolCalls && (
                          <div className="mt-2 pt-2 border-t border-[var(--rule)]">
                            <p className="text-[10px] text-[var(--ink-muted)] font-mono">
                              Tools used:{" "}
                              {JSON.parse(msg.toolCalls)
                                .map(
                                  (tc: { name: string }) => tc.name
                                )
                                .join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-[var(--rule)]">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleSend();
                      }
                    }}
                    placeholder="Ask anything..."
                    rows={2}
                    className="text-sm flex-1 resize-none"
                    disabled={sending || !clientId}
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={sending || !input.trim() || !clientId}
                    className="self-end bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-[var(--ink-muted)] mt-1">
                  Cmd+Enter to send · Cmd+J to toggle
                </p>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
