"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Hash,
  Volume2,
  Plus,
  Settings,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  ChevronDown,
  ChevronRight,
  Pin,
  Reply,
  Pencil,
  Trash2,
  MoreHorizontal,
  Smile,
  Paperclip,
  Send,
  X,
  Users,
  Check,
  AtSign,
  Bold,
  Italic,
  Code,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/store/user";
import { useTeamChat, type EnrichedMessage, type EnrichedChannel } from "@/store/team-chat";

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCORD_COLORS = {
  sidebar: "#2b2d31",
  sidebarDark: "#1e1f22",
  content: "#313338",
  input: "#383a40",
  inputBorder: "#1e1f22",
  text: "#dbdee1",
  textMuted: "#949ba4",
  textLink: "#00a8fc",
  accent: "#5865f2",
  accentHover: "#4752c4",
  online: "#23a55a",
  idle: "#f0b132",
  dnd: "#f23f43",
  offline: "#80848e",
  hover: "rgba(255,255,255,0.06)",
  active: "rgba(255,255,255,0.1)",
  divider: "rgba(255,255,255,0.06)",
  mention: "rgba(88,101,242,0.15)",
};

// Deterministic color from userId
function avatarColor(userId: string): string {
  const colors = [
    "#5865f2", "#57f287", "#fee75c", "#eb459e",
    "#ed4245", "#3ba55c", "#faa61a", "#00b0f4",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👀", "✅"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({
  userId,
  name,
  size = 32,
}: {
  userId: string;
  name: string;
  size?: number;
}) {
  const color = avatarColor(userId);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size * 0.35,
        fontWeight: 600,
        color: "#fff",
        userSelect: "none",
      }}
    >
      {initials(name)}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    online: DISCORD_COLORS.online,
    idle: DISCORD_COLORS.idle,
    dnd: DISCORD_COLORS.dnd,
    offline: DISCORD_COLORS.offline,
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: colorMap[status] || DISCORD_COLORS.offline,
        border: `2px solid ${DISCORD_COLORS.sidebarDark}`,
        flexShrink: 0,
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamChatPage() {
  const { user } = useUser();
  const {
    activeChannelId,
    channels,
    messages,
    reactions,
    onlineUsers,
    channelMembers,
    showMemberList,
    replyingTo,
    editingMessageId,
    selectedMessage,
    contextMenuPos,
    showEmojiPicker,
    emojiPickerMessageId,
    setActiveChannel,
    setChannels,
    setMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    setReactions,
    setOnlineUsers,
    setChannelMembers,
    setSelectedMessage,
    setReplyingTo,
    setEditingMessageId,
    toggleMemberList,
    setShowEmojiPicker,
    markChannelRead,
    incrementUnread,
  } = useTeamChat();

  const [input, setInput] = useState("");
  const [editInput, setEditInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [connectedVoice, setConnectedVoice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isFounder = user?.role === "founder";
  const isManager = user?.role === "manager";
  const canManage = isFounder || isManager;

  // ── Data loading ───────────────────────────────────────────────────────────

  // Load channels
  useEffect(() => {
    fetch("/api/team-chat/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data);
        if (data.length > 0 && !activeChannelId) {
          setActiveChannel(data[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load team users for DMs / mentions
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        const active = (Array.isArray(data) ? data : []).filter(
          (u: { id: string; status: string }) => u.status === "active"
        );
        setTeamUsers(active);
      })
      .catch(() => {});
  }, []);

  // Load presence
  useEffect(() => {
    const loadPresence = () => {
      fetch("/api/team-chat/presence")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setOnlineUsers(data);
        })
        .catch(() => {});
    };
    loadPresence();
    const interval = setInterval(loadPresence, 15000);
    return () => clearInterval(interval);
  }, [setOnlineUsers]);

  // Update own presence
  useEffect(() => {
    if (!user) return;
    fetch("/api/team-chat/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "online" }),
    }).catch(() => {});

    const handleVisibility = () => {
      const status = document.hidden ? "idle" : "online";
      fetch("/api/team-chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      fetch("/api/team-chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "offline" }),
      }).catch(() => {});
    };
  }, [user]);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;
    fetch(`/api/team-chat/channels/${activeChannelId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
        markChannelRead(activeChannelId);
      })
      .catch(() => {});
  }, [activeChannelId, setMessages, markChannelRead]);

  // Load channel members when channel changes
  useEffect(() => {
    if (!activeChannelId) return;
    fetch(`/api/team-chat/channels/${activeChannelId}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChannelMembers(activeChannelId, data);
      })
      .catch(() => {});
  }, [activeChannelId, setChannelMembers]);

  // SSE for real-time
  useEffect(() => {
    if (!activeChannelId) return;

    eventSourceRef.current?.close();

    const es = new EventSource(`/api/team-chat/channels/${activeChannelId}/stream`);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as EnrichedMessage;
        addMessage(msg);
        if (msg.userId !== user?.id) {
          incrementUnread(activeChannelId);
        }
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {};
    eventSourceRef.current = es;

    return () => es.close();
  }, [activeChannelId, addMessage, incrementUnread, user?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setSelectedMessage(null);
      }
    };
    if (selectedMessage) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedMessage, setSelectedMessage]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const textChannels = useMemo(
    () => channels.filter((c) => c.type === "group"),
    [channels]
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => c.type === "voice"),
    [channels]
  );
  const dmChannels = useMemo(
    () => channels.filter((c) => c.type === "direct"),
    [channels]
  );
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const currentMembers = activeChannelId ? channelMembers[activeChannelId] || [] : [];
  const onlineMembers = currentMembers.filter((m) => {
    const presence = onlineUsers.find((u) => u.userId === m.userId);
    return presence?.status === "online" || presence?.status === "idle" || presence?.status === "dnd";
  });
  const offlineMembers = currentMembers.filter((m) => {
    const presence = onlineUsers.find((u) => u.userId === m.userId);
    return !presence || presence.status === "offline";
  });

  // Mention autocomplete
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return teamUsers.filter((u) =>
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== user?.id
    ).slice(0, 8);
  }, [mentionQuery, teamUsers, user?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !activeChannelId) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const body: Record<string, unknown> = { content };
      if (replyingTo) body.replyToId = replyingTo.id;
      setReplyingTo(null);

      await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Error sending
    } finally {
      setSending(false);
    }
  }, [input, sending, activeChannelId, replyingTo, setReplyingTo]);

  const handleEditSave = useCallback(
    async (msgId: string) => {
      if (!editInput.trim()) return;
      try {
        const res = await fetch(
          `/api/team-chat/channels/${activeChannelId}/messages/${msgId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: editInput.trim() }),
          }
        );
        if (res.ok) {
          const updated = await res.json();
          updateMessage(msgId, { content: updated.content, editedAt: updated.editedAt });
        }
      } catch {
        //
      }
      setEditingMessageId(null);
      setEditInput("");
    },
    [editInput, activeChannelId, updateMessage, setEditingMessageId]
  );

  const handleDelete = useCallback(
    async (msgId: string) => {
      if (!confirm("Delete this message?")) return;
      try {
        const res = await fetch(
          `/api/team-chat/channels/${activeChannelId}/messages/${msgId}`,
          { method: "DELETE" }
        );
        if (res.ok) deleteMessage(msgId);
      } catch {
        //
      }
      setSelectedMessage(null);
    },
    [activeChannelId, deleteMessage, setSelectedMessage]
  );

  const handlePin = useCallback(
    async (msgId: string) => {
      try {
        await fetch(
          `/api/team-chat/channels/${activeChannelId}/messages/${msgId}/pin`,
          { method: "POST" }
        );
        // Refresh messages
        const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages`);
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
      } catch {
        //
      }
      setSelectedMessage(null);
    },
    [activeChannelId, setMessages, setSelectedMessage]
  );

  const handleReact = useCallback(
    async (msgId: string, emoji: string) => {
      try {
        await fetch(
          `/api/team-chat/channels/${activeChannelId}/messages/${msgId}/react`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji }),
          }
        );
        // Refresh reactions
        const res = await fetch(
          `/api/team-chat/channels/${activeChannelId}/messages/${msgId}/react`
        );
        const data = await res.json();
        if (Array.isArray(data)) setReactions(msgId, data);
      } catch {
        //
      }
      setShowEmojiPicker(false);
      setSelectedMessage(null);
    },
    [activeChannelId, setReactions, setShowEmojiPicker, setSelectedMessage]
  );

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
      //
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    const res = await fetch("/api/team-chat/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", name: newChannelName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      const newChannels = await fetch("/api/team-chat/channels").then((r) => r.json());
      setChannels(newChannels);
      setActiveChannel(data.id);
    }
    setShowNewChannel(false);
    setNewChannelName("");
  };

  const handleCreateDm = async (targetUserId: string) => {
    const res = await fetch("/api/team-chat/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    setShowNewDm(false);
    const newChannels = await fetch("/api/team-chat/channels").then((r) => r.json());
    setChannels(newChannels);
    setActiveChannel(data.id);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention autocomplete nav
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionSuggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = mentionSuggestions[mentionIndex];
        if (selected) {
          const atIdx = input.lastIndexOf("@");
          const newInput = input.slice(0, atIdx) + `@${selected.name} `;
          setInput(newInput);
          setMentionQuery(null);
          setMentionIndex(0);
        }
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Detect @mention
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setMentionQuery(afterAt);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertFormat = (prefix: string, suffix: string = prefix) => {
    const ta = inputRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = input.slice(start, end);
    const newVal = input.slice(0, start) + prefix + selected + suffix + input.slice(end);
    setInput(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const onContextMenu = (e: React.MouseEvent, msg: EnrichedMessage) => {
    e.preventDefault();
    setSelectedMessage(msg, { x: e.clientX, y: e.clientY });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: DISCORD_COLORS.content, color: DISCORD_COLORS.text, fontFamily: "inherit" }}
      onClick={() => {
        if (selectedMessage) setSelectedMessage(null);
        if (showEmojiPicker) setShowEmojiPicker(false);
      }}
    >
      {/* ── Left Sidebar ── */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: 240,
          background: DISCORD_COLORS.sidebar,
          borderRight: `1px solid ${DISCORD_COLORS.divider}`,
        }}
      >
        {/* Server header */}
        <div
          className="flex items-center justify-between px-4 h-12 shrink-0 font-semibold text-sm cursor-pointer"
          style={{
            borderBottom: `1px solid ${DISCORD_COLORS.divider}`,
            color: DISCORD_COLORS.text,
          }}
        >
          <span>Adchemy Team</span>
          <ChevronDown className="w-4 h-4" style={{ color: DISCORD_COLORS.textMuted }} />
        </div>

        <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin" }}>

          {/* DMs */}
          {dmChannels.length > 0 && (
            <div className="mb-2">
              <div
                className="flex items-center px-4 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: DISCORD_COLORS.textMuted }}
              >
                Direct Messages
              </div>
              {dmChannels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  active={ch.id === activeChannelId}
                  icon={<AtSign className="w-4 h-4" strokeWidth={1.5} />}
                  onSelect={() => setActiveChannel(ch.id)}
                  onlineUsers={onlineUsers}
                  teamUsers={teamUsers}
                  currentUserId={user?.id}
                />
              ))}
              <button
                onClick={() => setShowNewDm(!showNewDm)}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-sm"
                style={{ color: DISCORD_COLORS.textMuted }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New DM</span>
              </button>
            </div>
          )}

          {/* Text Channels */}
          <div className="mb-2">
            <button
              className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider"
              style={{ color: DISCORD_COLORS.textMuted }}
              onClick={() => setTextChannelsOpen((v) => !v)}
            >
              {textChannelsOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Text Channels</span>
              {canManage && (
                <button
                  className="ml-auto p-0.5 rounded hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewChannel(true);
                  }}
                  title="Create channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </button>

            {textChannelsOpen && (
              <>
                {textChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    active={ch.id === activeChannelId}
                    icon={<Hash className="w-4 h-4" strokeWidth={1.5} />}
                    onSelect={() => setActiveChannel(ch.id)}
                    onlineUsers={onlineUsers}
                    teamUsers={teamUsers}
                    currentUserId={user?.id}
                    canManage={canManage}
                    isFounder={isFounder}
                    onDeleteChannel={async (id) => {
                      if (!confirm("Delete channel?")) return;
                      const res = await fetch(`/api/team-chat/channels/${id}`, { method: "DELETE" });
                      if (res.ok) {
                        const updated = await fetch("/api/team-chat/channels").then((r) => r.json());
                        setChannels(updated);
                        if (activeChannelId === id) setActiveChannel(updated[0]?.id || null);
                      }
                    }}
                  />
                ))}
              </>
            )}
          </div>

          {/* Voice Channels */}
          <div className="mb-2">
            <button
              className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider"
              style={{ color: DISCORD_COLORS.textMuted }}
              onClick={() => setVoiceChannelsOpen((v) => !v)}
            >
              {voiceChannelsOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Voice Channels</span>
            </button>
            {voiceChannelsOpen && (
              <button
                onClick={() => setConnectedVoice("general-voice")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded mx-1"
                style={{
                  color: connectedVoice ? DISCORD_COLORS.online : DISCORD_COLORS.textMuted,
                  background: connectedVoice ? DISCORD_COLORS.active : "transparent",
                  width: "calc(100% - 8px)",
                }}
              >
                <Volume2 className="w-4 h-4" strokeWidth={1.5} />
                <span>General Voice</span>
              </button>
            )}
          </div>

          {/* Add DM button if no DMs yet */}
          {dmChannels.length === 0 && (
            <button
              onClick={() => setShowNewDm(!showNewDm)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm w-full"
              style={{ color: DISCORD_COLORS.textMuted }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New DM</span>
            </button>
          )}
        </div>

        {/* New Channel form */}
        <AnimatePresence>
          {showNewChannel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 py-2 overflow-hidden"
              style={{ borderTop: `1px solid ${DISCORD_COLORS.divider}` }}
            >
              <p className="text-xs mb-1" style={{ color: DISCORD_COLORS.textMuted }}>
                Create Text Channel
              </p>
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateChannel();
                  if (e.key === "Escape") setShowNewChannel(false);
                }}
                placeholder="channel-name"
                className="w-full rounded px-2 py-1 text-sm outline-none"
                style={{
                  background: DISCORD_COLORS.input,
                  color: DISCORD_COLORS.text,
                  border: `1px solid ${DISCORD_COLORS.inputBorder}`,
                }}
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={handleCreateChannel}
                  className="flex-1 py-1 rounded text-xs font-medium"
                  style={{ background: DISCORD_COLORS.accent, color: "#fff" }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewChannel(false)}
                  className="flex-1 py-1 rounded text-xs font-medium"
                  style={{ background: DISCORD_COLORS.hover, color: DISCORD_COLORS.textMuted }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New DM form */}
        <AnimatePresence>
          {showNewDm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 py-2 overflow-hidden"
              style={{ borderTop: `1px solid ${DISCORD_COLORS.divider}` }}
            >
              <p className="text-xs mb-1" style={{ color: DISCORD_COLORS.textMuted }}>
                New Direct Message
              </p>
              <div className="max-h-40 overflow-y-auto">
                {teamUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleCreateDm(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left"
                      style={{ color: DISCORD_COLORS.text }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = DISCORD_COLORS.hover)
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                      }
                    >
                      <Avatar userId={u.id} name={u.name} size={24} />
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setShowNewDm(false)}
                className="w-full mt-1 py-0.5 rounded text-xs"
                style={{ color: DISCORD_COLORS.textMuted }}
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User info bar at bottom */}
        {user && (
          <div
            className="flex items-center gap-2 px-2 py-2 shrink-0"
            style={{
              background: DISCORD_COLORS.sidebarDark,
              borderTop: `1px solid ${DISCORD_COLORS.divider}`,
            }}
          >
            <div className="relative">
              <Avatar userId={user.id} name={user.name} size={32} />
              <span
                className="absolute -bottom-0.5 -right-0.5"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: DISCORD_COLORS.online,
                  border: `2px solid ${DISCORD_COLORS.sidebarDark}`,
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: DISCORD_COLORS.text }}>
                {user.name}
              </p>
              <p className="text-xs truncate" style={{ color: DISCORD_COLORS.textMuted }}>
                {user.role}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted(!muted)}
                className="p-1 rounded"
                title={muted ? "Unmute" : "Mute"}
                style={{ color: muted ? DISCORD_COLORS.dnd : DISCORD_COLORS.textMuted }}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setDeafened(!deafened)}
                className="p-1 rounded"
                title={deafened ? "Undeafen" : "Deafen"}
                style={{ color: deafened ? DISCORD_COLORS.dnd : DISCORD_COLORS.textMuted }}
              >
                <Headphones className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Center: Messages ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Channel Header */}
        <div
          className="flex items-center justify-between px-4 h-12 shrink-0"
          style={{
            background: DISCORD_COLORS.content,
            borderBottom: `1px solid ${DISCORD_COLORS.divider}`,
            zIndex: 10,
          }}
        >
          <div className="flex items-center gap-2">
            {activeChannel?.type === "group" ? (
              <Hash className="w-5 h-5" style={{ color: DISCORD_COLORS.textMuted }} strokeWidth={2} />
            ) : activeChannel?.type === "direct" ? (
              <AtSign className="w-5 h-5" style={{ color: DISCORD_COLORS.textMuted }} strokeWidth={2} />
            ) : null}
            <span className="font-semibold text-sm" style={{ color: DISCORD_COLORS.text }}>
              {activeChannel
                ? activeChannel.displayName || activeChannel.name || "Direct Message"
                : "Select a channel"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMemberList}
              className="p-1.5 rounded"
              title="Toggle member list"
              style={{ color: showMemberList ? DISCORD_COLORS.text : DISCORD_COLORS.textMuted }}
            >
              <Users className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voice connection bar */}
        <AnimatePresence>
          {connectedVoice && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 36 }}
              exit={{ height: 0 }}
              className="flex items-center justify-between px-4 overflow-hidden shrink-0"
              style={{ background: "#23a55a22", borderBottom: `1px solid ${DISCORD_COLORS.divider}` }}
            >
              <div className="flex items-center gap-2 text-sm" style={{ color: DISCORD_COLORS.online }}>
                <Volume2 className="w-4 h-4" />
                <span>Connected to Voice – General Voice</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setMuted(!muted)} className="p-1 rounded" style={{ color: muted ? DISCORD_COLORS.dnd : DISCORD_COLORS.online }}>
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button onClick={() => setDeafened(!deafened)} className="p-1 rounded" style={{ color: deafened ? DISCORD_COLORS.dnd : DISCORD_COLORS.online }}>
                  <Headphones className="w-4 h-4" />
                </button>
                <button onClick={() => setConnectedVoice(null)} className="p-1 rounded" style={{ color: DISCORD_COLORS.dnd }}>
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${DISCORD_COLORS.inputBorder} transparent` }}
        >
          {!activeChannelId && (
            <div className="h-full flex items-center justify-center" style={{ color: DISCORD_COLORS.textMuted }}>
              <div className="text-center">
                <Hash className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a channel to start chatting</p>
              </div>
            </div>
          )}

          {activeChannelId && messages.length === 0 && (
            <div className="pt-8 pb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: DISCORD_COLORS.accent }}
              >
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: DISCORD_COLORS.text }}>
                Welcome to #{activeChannel?.name || "channel"}!
              </h2>
              <p className="text-sm" style={{ color: DISCORD_COLORS.textMuted }}>
                This is the start of the #{activeChannel?.name} channel.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const isGrouped =
              prev &&
              prev.userId === msg.userId &&
              isSameDay(prev.createdAt, msg.createdAt) &&
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const isOwn = msg.userId === user?.id;
            const msgReactions = reactions[msg.id] || msg.reactions || [];

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px" style={{ background: DISCORD_COLORS.divider }} />
                    <span className="text-xs font-medium" style={{ color: DISCORD_COLORS.textMuted }}>
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: DISCORD_COLORS.divider }} />
                  </div>
                )}

                <div
                  className="group flex gap-3 px-2 py-0.5 rounded relative"
                  style={{
                    background: msg.pinnedAt ? "rgba(250,166,26,0.06)" : "transparent",
                    marginTop: isGrouped ? 0 : 16,
                  }}
                  onContextMenu={(e) => onContextMenu(e, msg)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      msg.pinnedAt ? "rgba(250,166,26,0.09)" : DISCORD_COLORS.hover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      msg.pinnedAt ? "rgba(250,166,26,0.06)" : "transparent";
                  }}
                >
                  {/* Avatar column */}
                  <div className="w-10 shrink-0 flex items-start justify-center pt-0.5">
                    {!isGrouped ? (
                      <Avatar userId={msg.userId} name={msg.userName || "?"} size={40} />
                    ) : (
                      <span
                        className="text-[10px] opacity-0 group-hover:opacity-100 mt-1 select-none"
                        style={{ color: DISCORD_COLORS.textMuted }}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-medium text-sm" style={{ color: DISCORD_COLORS.text }}>
                          {isOwn ? "You" : msg.userName}
                        </span>
                        {msg.userRole && (
                          <span
                            className="text-[10px] px-1 rounded font-medium"
                            style={{
                              background: msg.userRole === "founder" ? "#5865f222" : "#57f28722",
                              color: msg.userRole === "founder" ? "#5865f2" : "#57f287",
                            }}
                          >
                            {msg.userRole}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: DISCORD_COLORS.textMuted }}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {msg.pinnedAt && (
                          <Pin className="w-3 h-3" style={{ color: DISCORD_COLORS.idle }} />
                        )}
                      </div>
                    )}

                    {/* Reply preview */}
                    {msg.replyToId && (
                      <ReplyPreview
                        replyToId={msg.replyToId}
                        messages={messages}
                        teamUsers={teamUsers}
                      />
                    )}

                    {/* Edit mode */}
                    {editingMessageId === msg.id ? (
                      <div>
                        <textarea
                          ref={editInputRef}
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleEditSave(msg.id);
                            }
                            if (e.key === "Escape") {
                              setEditingMessageId(null);
                              setEditInput("");
                            }
                          }}
                          className="w-full rounded px-3 py-2 text-sm resize-none outline-none"
                          style={{
                            background: DISCORD_COLORS.input,
                            color: DISCORD_COLORS.text,
                            border: `1px solid ${DISCORD_COLORS.accent}`,
                          }}
                          rows={2}
                          autoFocus
                        />
                        <p className="text-xs mt-1" style={{ color: DISCORD_COLORS.textMuted }}>
                          Enter to save · Esc to cancel
                        </p>
                      </div>
                    ) : (
                      <>
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words" style={{ color: DISCORD_COLORS.text }}>
                            {msg.content}
                            {msg.editedAt && (
                              <span className="text-xs ml-1" style={{ color: DISCORD_COLORS.textMuted }}>
                                (edited)
                              </span>
                            )}
                          </p>
                        )}
                        {msg.mediaUrl && msg.mediaType === "image" && (
                          <img
                            src={msg.mediaUrl}
                            alt=""
                            className="max-w-sm rounded-md mt-1"
                            style={{ border: `1px solid ${DISCORD_COLORS.divider}` }}
                          />
                        )}
                        {msg.mediaUrl && msg.mediaType === "video" && (
                          <video src={msg.mediaUrl} controls className="max-w-sm rounded-md mt-1" />
                        )}
                      </>
                    )}

                    {/* Reactions */}
                    {msgReactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msgReactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReact(msg.id, r.emoji);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm"
                            style={{
                              background: r.hasMe
                                ? `${DISCORD_COLORS.accent}33`
                                : DISCORD_COLORS.input,
                              border: `1px solid ${r.hasMe ? DISCORD_COLORS.accent : DISCORD_COLORS.divider}`,
                              color: DISCORD_COLORS.text,
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-xs">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover action bar */}
                  <div
                    className="absolute right-2 top-0 -translate-y-1/2 hidden group-hover:flex items-center gap-1 rounded px-1 py-0.5 z-10"
                    style={{
                      background: DISCORD_COLORS.sidebar,
                      border: `1px solid ${DISCORD_COLORS.divider}`,
                      top: "-1px",
                      transform: "translateY(-50%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Quick react */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(true, msg.id);
                      }}
                      className="p-1 rounded text-xs"
                      style={{ color: DISCORD_COLORS.textMuted }}
                      title="Add reaction"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {/* Reply */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(msg);
                        inputRef.current?.focus();
                      }}
                      className="p-1 rounded"
                      style={{ color: DISCORD_COLORS.textMuted }}
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                    {/* Edit (own only) */}
                    {isOwn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditInput(msg.content);
                          setEditingMessageId(msg.id);
                        }}
                        className="p-1 rounded"
                        style={{ color: DISCORD_COLORS.textMuted }}
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {/* More */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(msg, { x: e.clientX, y: e.clientY });
                      }}
                      className="p-1 rounded"
                      style={{ color: DISCORD_COLORS.textMuted }}
                      title="More options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick emoji picker (inline) */}
                  <AnimatePresence>
                    {showEmojiPicker && emojiPickerMessageId === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute right-2 z-20 rounded-lg p-2 flex gap-1"
                        style={{
                          background: DISCORD_COLORS.sidebar,
                          border: `1px solid ${DISCORD_COLORS.divider}`,
                          top: "100%",
                          marginTop: 4,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="text-lg hover:scale-125 transition-transform"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {activeChannelId && (
          <div
            className="px-4 pb-4 pt-2 shrink-0"
            style={{ background: DISCORD_COLORS.content }}
          >
            {/* Reply preview bar */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-lg overflow-hidden"
                  style={{ background: DISCORD_COLORS.input }}
                >
                  <Reply className="w-3.5 h-3.5 shrink-0" style={{ color: DISCORD_COLORS.textMuted }} />
                  <span className="text-xs" style={{ color: DISCORD_COLORS.textMuted }}>
                    Replying to{" "}
                    <span style={{ color: DISCORD_COLORS.text, fontWeight: 500 }}>
                      {replyingTo.userName || "Unknown"}
                    </span>
                    {" – "}
                    <span className="truncate">{replyingTo.content?.slice(0, 60)}</span>
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="ml-auto"
                    style={{ color: DISCORD_COLORS.textMuted }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Format toolbar */}
            <div
              className="flex items-center gap-1 px-3 py-1 rounded-t-lg"
              style={{ background: DISCORD_COLORS.input }}
            >
              <button
                onClick={() => insertFormat("**")}
                className="p-1 rounded text-xs font-bold"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => insertFormat("*")}
                className="p-1 rounded"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => insertFormat("`")}
                className="p-1 rounded"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => insertFormat("~~")}
                className="p-1 rounded text-xs"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Strikethrough"
              >
                <span className="text-xs font-medium line-through">S</span>
              </button>
              <div className="w-px h-4 mx-1" style={{ background: DISCORD_COLORS.divider }} />
              <button
                onClick={() => insertFormat("||")}
                className="p-1 rounded text-xs"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Spoiler"
              >
                <span className="text-xs font-medium">||</span>
              </button>
            </div>

            {/* Main input row */}
            <div
              className="flex items-end gap-2 px-3 py-2 rounded-b-lg"
              style={{ background: DISCORD_COLORS.input }}
            >
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
                className="p-1 rounded"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Attach file"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              <div className="flex-1 relative">
                {/* Mention autocomplete */}
                <AnimatePresence>
                  {mentionSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full mb-1 left-0 right-0 rounded-lg overflow-hidden z-20"
                      style={{
                        background: DISCORD_COLORS.sidebar,
                        border: `1px solid ${DISCORD_COLORS.divider}`,
                      }}
                    >
                      {mentionSuggestions.map((u, idx) => (
                        <button
                          key={u.id}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                          style={{
                            background: idx === mentionIndex ? DISCORD_COLORS.active : "transparent",
                            color: DISCORD_COLORS.text,
                          }}
                          onClick={() => {
                            const atIdx = input.lastIndexOf("@");
                            const newInput = input.slice(0, atIdx) + `@${u.name} `;
                            setInput(newInput);
                            setMentionQuery(null);
                            inputRef.current?.focus();
                          }}
                        >
                          <Avatar userId={u.id} name={u.name} size={24} />
                          <span>{u.name}</span>
                          <span className="text-xs ml-auto" style={{ color: DISCORD_COLORS.textMuted }}>
                            {u.role}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder={`Message ${activeChannel?.type === "group" ? "#" : ""}${activeChannel?.displayName || activeChannel?.name || "..."}`}
                  rows={1}
                  disabled={sending}
                  className="w-full resize-none outline-none text-sm bg-transparent"
                  style={{
                    color: DISCORD_COLORS.text,
                    maxHeight: 120,
                    lineHeight: 1.5,
                  }}
                  onInput={(e) => {
                    const ta = e.currentTarget;
                    ta.style.height = "auto";
                    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
                  }}
                />
              </div>

              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker, undefined)}
                className="p-1 rounded"
                style={{ color: DISCORD_COLORS.textMuted }}
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="p-1.5 rounded"
                style={{
                  background: input.trim() ? DISCORD_COLORS.accent : "transparent",
                  color: input.trim() ? "#fff" : DISCORD_COLORS.textMuted,
                  transition: "all 0.15s",
                }}
                title="Send"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Global emoji picker (for input) */}
            <AnimatePresence>
              {showEmojiPicker && !emojiPickerMessageId && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-20 right-8 rounded-lg p-3 z-30"
                  style={{
                    background: DISCORD_COLORS.sidebar,
                    border: `1px solid ${DISCORD_COLORS.divider}`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs mb-2" style={{ color: DISCORD_COLORS.textMuted }}>
                    Quick Emojis
                  </p>
                  <div className="grid grid-cols-5 gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setInput((v) => v + emoji);
                          setShowEmojiPicker(false);
                          inputRef.current?.focus();
                        }}
                        className="text-xl hover:scale-125 transition-transform p-1 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Right: Member List ── */}
      <AnimatePresence>
        {showMemberList && activeChannelId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden"
            style={{
              background: DISCORD_COLORS.sidebar,
              borderLeft: `1px solid ${DISCORD_COLORS.divider}`,
            }}
          >
            <div className="w-[240px] h-full overflow-y-auto py-4 px-2" style={{ scrollbarWidth: "thin" }}>
              {/* Online members */}
              {onlineMembers.length > 0 && (
                <div className="mb-4">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider px-2 mb-1"
                    style={{ color: DISCORD_COLORS.textMuted }}
                  >
                    Online — {onlineMembers.length}
                  </p>
                  {onlineMembers.map((m) => {
                    const presence = onlineUsers.find((u) => u.userId === m.userId);
                    return (
                      <MemberRow
                        key={m.userId}
                        member={m}
                        status={presence?.status || "online"}
                        isCurrentUser={m.userId === user?.id}
                      />
                    );
                  })}
                </div>
              )}

              {/* Offline members */}
              {offlineMembers.length > 0 && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider px-2 mb-1"
                    style={{ color: DISCORD_COLORS.textMuted }}
                  >
                    Offline — {offlineMembers.length}
                  </p>
                  {offlineMembers.map((m) => (
                    <MemberRow
                      key={m.userId}
                      member={m}
                      status="offline"
                      isCurrentUser={m.userId === user?.id}
                    />
                  ))}
                </div>
              )}

              {currentMembers.length === 0 && (
                <p className="text-xs px-2" style={{ color: DISCORD_COLORS.textMuted }}>
                  No members
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Context Menu ── */}
      <AnimatePresence>
        {selectedMessage && contextMenuPos && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 rounded-lg py-1 min-w-[180px]"
            style={{
              left: Math.min(contextMenuPos.x, window.innerWidth - 200),
              top: Math.min(contextMenuPos.y, window.innerHeight - 300),
              background: DISCORD_COLORS.sidebarDark,
              border: `1px solid ${DISCORD_COLORS.divider}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem
              icon={<Smile className="w-4 h-4" />}
              label="Add Reaction"
              onClick={() => {
                setShowEmojiPicker(true, selectedMessage.id);
                setSelectedMessage(null);
              }}
            />
            <ContextMenuItem
              icon={<Reply className="w-4 h-4" />}
              label="Reply"
              onClick={() => {
                setReplyingTo(selectedMessage);
                setSelectedMessage(null);
                inputRef.current?.focus();
              }}
            />
            {selectedMessage.userId === user?.id && (
              <ContextMenuItem
                icon={<Pencil className="w-4 h-4" />}
                label="Edit Message"
                onClick={() => {
                  setEditInput(selectedMessage.content);
                  setEditingMessageId(selectedMessage.id);
                  setSelectedMessage(null);
                }}
              />
            )}
            {canManage && (
              <ContextMenuItem
                icon={<Pin className="w-4 h-4" />}
                label={selectedMessage.pinnedAt ? "Unpin Message" : "Pin Message"}
                onClick={() => handlePin(selectedMessage.id)}
              />
            )}
            <div className="h-px my-1" style={{ background: DISCORD_COLORS.divider }} />
            <ContextMenuItem
              icon={<Check className="w-4 h-4" />}
              label="Copy Text"
              onClick={() => {
                navigator.clipboard.writeText(selectedMessage.content).catch(() => {});
                setSelectedMessage(null);
              }}
            />
            {(selectedMessage.userId === user?.id || isFounder) && (
              <>
                <div className="h-px my-1" style={{ background: DISCORD_COLORS.divider }} />
                <ContextMenuItem
                  icon={<Trash2 className="w-4 h-4" />}
                  label="Delete Message"
                  danger
                  onClick={() => handleDelete(selectedMessage.id)}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helper sub-components ─────────────────────────────────────────────────────

function ChannelItem({
  channel,
  active,
  icon,
  onSelect,
  onlineUsers,
  teamUsers,
  currentUserId,
  canManage,
  isFounder,
  onDeleteChannel,
}: {
  channel: EnrichedChannel;
  active: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  onlineUsers: Array<{ userId: string; status: string }>;
  teamUsers: Array<{ id: string; name: string }>;
  currentUserId?: string;
  canManage?: boolean;
  isFounder?: boolean;
  onDeleteChannel?: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);

  const displayName =
    channel.displayName ||
    channel.name ||
    (() => {
      // For DMs, can't resolve here without more info — use what we have
      return "Direct Message";
    })();

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md mx-1 group text-sm"
      style={{
        width: "calc(100% - 8px)",
        background: active ? DISCORD_COLORS.active : hover ? DISCORD_COLORS.hover : "transparent",
        color: active ? DISCORD_COLORS.text : DISCORD_COLORS.textMuted,
        transition: "background 0.1s",
      }}
    >
      <span style={{ color: active ? DISCORD_COLORS.text : DISCORD_COLORS.textMuted }}>{icon}</span>
      <span className="flex-1 truncate text-left">{displayName}</span>
      {(channel.unread ?? 0) > 0 && (
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: DISCORD_COLORS.dnd }}
        >
          {(channel.unread ?? 0) > 9 ? "9+" : channel.unread}
        </span>
      )}
      {hover && canManage && channel.name !== "General" && onDeleteChannel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteChannel(channel.id);
          }}
          className="p-0.5 rounded opacity-60 hover:opacity-100"
          style={{ color: DISCORD_COLORS.textMuted }}
          title="Delete channel"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}
    </button>
  );
}

function MemberRow({
  member,
  status,
  isCurrentUser,
}: {
  member: { userId: string; name: string; role: string };
  status: string;
  isCurrentUser: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-default"
      style={{ opacity: status === "offline" ? 0.5 : 1 }}
    >
      <div className="relative">
        <Avatar userId={member.userId} name={member.name} size={32} />
        <span
          className="absolute -bottom-0.5 -right-0.5"
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: {
              online: DISCORD_COLORS.online,
              idle: DISCORD_COLORS.idle,
              dnd: DISCORD_COLORS.dnd,
              offline: DISCORD_COLORS.offline,
            }[status] || DISCORD_COLORS.offline,
            border: `2px solid ${DISCORD_COLORS.sidebar}`,
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: DISCORD_COLORS.text }}
        >
          {member.name}
          {isCurrentUser && (
            <span className="text-xs ml-1" style={{ color: DISCORD_COLORS.textMuted }}>
              (you)
            </span>
          )}
        </p>
        <p className="text-xs truncate" style={{ color: DISCORD_COLORS.textMuted }}>
          {member.role}
        </p>
      </div>
    </div>
  );
}

function ReplyPreview({
  replyToId,
  messages,
  teamUsers,
}: {
  replyToId: string;
  messages: EnrichedMessage[];
  teamUsers: Array<{ id: string; name: string }>;
}) {
  const original = messages.find((m) => m.id === replyToId);
  if (!original) return null;

  return (
    <div
      className="flex items-center gap-1 mb-1 pl-2 text-xs rounded"
      style={{
        borderLeft: `2px solid ${DISCORD_COLORS.textMuted}`,
        color: DISCORD_COLORS.textMuted,
      }}
    >
      <Reply className="w-3 h-3 shrink-0" />
      <span className="font-medium" style={{ color: DISCORD_COLORS.text }}>
        {original.userName || "Unknown"}
      </span>
      <span className="truncate max-w-[200px]">{original.content?.slice(0, 80)}</span>
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm"
      style={{
        color: danger ? DISCORD_COLORS.dnd : DISCORD_COLORS.text,
        background: hover
          ? danger
            ? `${DISCORD_COLORS.dnd}22`
            : DISCORD_COLORS.hover
          : "transparent",
        transition: "background 0.1s",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
