"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, Plus, Hash, MessageCircle, Paperclip, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/store/user";
import { useTeamChat } from "@/store/team-chat";

interface ChatMsg {
  id: string;
  channelId: string;
  userId: string;
  userName?: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaExpiresAt: string | null;
  replyToId: string | null;
  createdAt: string;
}

export default function TeamChatPage() {
  const { user } = useUser();
  const {
    activeChannelId,
    channels,
    messages,
    setActiveChannel,
    setChannels,
    setMessages,
    addMessage,
  } = useTeamChat();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [showNewDm, setShowNewDm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load channels
  useEffect(() => {
    fetch("/api/team-chat/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data);
        if (data.length > 0 && !activeChannelId) {
          setActiveChannel(data[0].id);
        }
      });
  }, [setChannels, setActiveChannel, activeChannelId]);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    fetch(`/api/team-chat/channels/${activeChannelId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data));
  }, [activeChannelId, setMessages]);

  // SSE for real-time updates
  useEffect(() => {
    if (!activeChannelId) return;

    eventSourceRef.current?.close();

    const es = new EventSource(`/api/team-chat/channels/${activeChannelId}/stream`);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ChatMsg;
        // Avoid duplicates
        addMessage(msg);
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      // Will auto-reconnect
    };
    eventSourceRef.current = es;

    return () => es.close();
  }, [activeChannelId, addMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load team users for DM creation
  useEffect(() => {
    if (showNewDm) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          const active = (Array.isArray(data) ? data : []).filter(
            (u: { id: string; status: string }) => u.status === "active" && u.id !== user?.id
          );
          setTeamUsers(active);
        })
        .catch(() => {});
    }
  }, [showNewDm, user?.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !activeChannelId) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch {
      // Error sending
    } finally {
      setSending(false);
    }
  }, [input, sending, activeChannelId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (uploadRes.ok) {
        const { url, mediaType } = await uploadRes.json();
        await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "", mediaUrl: url, mediaType }),
        });
      }
    } catch {
      // Upload failed
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateDm = async (targetUserId: string) => {
    const res = await fetch("/api/team-chat/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    setShowNewDm(false);

    // Reload channels and switch
    const channelsRes = await fetch("/api/team-chat/channels");
    const newChannels = await channelsRes.json();
    setChannels(newChannels);
    setActiveChannel(data.id);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Channel list */}
      <div className="w-60 border-r border-[var(--rule)] flex flex-col shrink-0">
        <div className="p-3 border-b border-[var(--rule)] flex items-center justify-between">
          <span className="text-sm font-medium">Channels</span>
          <button
            onClick={() => setShowNewDm(!showNewDm)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)]"
            title="New DM"
          >
            <Plus className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </button>
        </div>

        {showNewDm && (
          <div className="p-2 border-b border-[var(--rule)] bg-[var(--muted)]">
            <p className="text-[10px] text-[var(--ink-muted)] mb-1 px-1">
              New direct message
            </p>
            {teamUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleCreateDm(u.id)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-[var(--surface)] truncate"
              >
                {u.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                ch.id === activeChannelId
                  ? "bg-[var(--muted)] font-medium"
                  : "hover:bg-[var(--muted)] text-[var(--ink-muted)]"
              }`}
            >
              {ch.type === "group" ? (
                <Hash className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              ) : (
                <MessageCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              )}
              <span className="truncate">{ch.name || "Direct message"}</span>
              {(ch.unread ?? 0) > 0 && (
                <span className="ml-auto w-5 h-5 bg-[var(--accent-clay)] text-white text-[10px] font-medium rounded-full flex items-center justify-center shrink-0">
                  {ch.unread! > 9 ? "9+" : ch.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="h-12 px-4 flex items-center border-b border-[var(--rule)]">
          <span className="text-sm font-medium">
            {activeChannel?.type === "group" ? "#" : ""}{" "}
            {activeChannel?.name || "Select a channel"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((msg, i) => {
            const isOwn = msg.userId === user?.id;
            const showName =
              i === 0 || messages[i - 1]?.userId !== msg.userId;

            return (
              <div key={msg.id}>
                {showName && (
                  <div className="flex items-center gap-2 mt-3 mb-1">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-clay)]/10 flex items-center justify-center">
                      <span className="text-[9px] font-medium text-[var(--accent-clay)]">
                        {(msg.userName || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                    <span className="text-xs font-medium">
                      {isOwn ? "You" : msg.userName}
                    </span>
                    <span className="text-[10px] text-[var(--ink-muted)]">
                      {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                <div className="pl-8">
                  {msg.content && (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.mediaUrl && msg.mediaType === "image" && (
                    <img
                      src={msg.mediaUrl}
                      alt=""
                      className="max-w-xs rounded-[var(--radius)] mt-1 border border-[var(--rule)]"
                    />
                  )}
                  {msg.mediaUrl && msg.mediaType === "video" && (
                    <video
                      src={msg.mediaUrl}
                      controls
                      className="max-w-xs rounded-[var(--radius)] mt-1"
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeChannelId && (
          <div className="px-4 py-3 border-t border-[var(--rule)]">
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] shrink-0"
                title="Attach media"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--ink-muted)]" />
                ) : (
                  <Paperclip className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                )}
              </button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="text-sm flex-1 resize-none"
                disabled={sending}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="self-end bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
