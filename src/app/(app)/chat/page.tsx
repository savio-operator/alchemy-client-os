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
  Send,
  X,
  Users,
  Check,
  AtSign,
  Bold,
  Italic,
  Code,
  Loader2,
  Bot,
  BarChart2,
  Upload,
  Bell,
  BellOff,
  Lock,
  Globe,
  UserPlus,
  ChevronUp,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/store/user";
import { useTeamChat, type EnrichedMessage, type EnrichedChannel, type PollData } from "@/store/team-chat";
import { VoiceClient, type VoiceParticipant } from "@/lib/voice-client";

// ─── Avatar helpers ────────────────────────────────────────────────────────────

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
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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

const COMMON_EMOJIS_BY_CATEGORY: Record<string, string[]> = {
  "Smileys": ["😀", "😂", "😍", "😎", "😢", "😡", "😮", "🥹", "🤣", "🥰", "😏", "🤔"],
  "Gestures": ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👌", "🫡", "🙏"],
  "Objects": ["🔥", "💯", "🎉", "✅", "❌", "⚡", "💡", "🎯", "🚀", "👀", "💬", "📌"],
};
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👀", "✅"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ userId, name, size = 32 }: { userId: string; name: string; size?: number }) {
  const color = avatarColor(userId);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", backgroundColor: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: size * 0.35, fontWeight: 600, color: "#fff", userSelect: "none",
      }}
    >
      {initials(name)}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    online: "#23a55a",
    idle: "#f0b132",
    dnd: "#f23f43",
    offline: "#80848e",
  };
  return (
    <span
      style={{
        display: "inline-block", width: 10, height: 10, borderRadius: "50%",
        backgroundColor: colorMap[status] || "#80848e",
        border: "2px solid var(--bg)", flexShrink: 0,
      }}
    />
  );
}

// ─── Poll Component ───────────────────────────────────────────────────────────

function PollMessage({ pollId, currentUserId }: { pollId: string; currentUserId?: string }) {
  const { polls, setPoll } = useTeamChat();
  const poll = polls[pollId];
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!poll) {
      fetch(`/api/team-chat/polls/${pollId}`)
        .then((r) => r.json())
        .then((data) => setPoll(pollId, data))
        .catch(() => {});
    }
  }, [pollId, poll, setPoll]);

  const handleVote = async (optionIndex: number) => {
    if (voting || !currentUserId) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/team-chat/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex }),
      });
      if (res.ok) {
        const data = await res.json();
        setPoll(pollId, { ...poll!, ...data });
      }
    } finally {
      setVoting(false);
    }
  };

  if (!poll) {
    return (
      <div className="flex items-center gap-2 text-[var(--ink-muted)] text-sm py-1">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading poll...</span>
      </div>
    );
  }

  const maxVotes = Math.max(...poll.voteCounts, 1);

  return (
    <div className="mt-1 rounded-lg border border-[var(--rule)] bg-[var(--bg)] p-3 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="w-4 h-4 text-[var(--accent-clay)]" />
        <span className="text-sm font-medium text-[var(--ink)]">{poll.question}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const pct = poll.totalVotes > 0 ? Math.round((poll.voteCounts[i] / poll.totalVotes) * 100) : 0;
          const isMyVote = poll.myVote === i;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={voting}
              className="relative w-full rounded text-left text-sm overflow-hidden"
              style={{ border: isMyVote ? "1px solid var(--accent-clay)" : "1px solid var(--rule)" }}
            >
              <div
                className="absolute inset-y-0 left-0 opacity-20 transition-all"
                style={{ width: `${pct}%`, background: "var(--accent-clay)" }}
              />
              <div className="relative flex items-center justify-between px-2 py-1.5">
                <span className="text-[var(--ink)]">{opt}</span>
                <span className="text-xs text-[var(--ink-muted)]">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--ink-muted)] mt-2">{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── Channel Settings Modal ────────────────────────────────────────────────────

function ChannelSettingsModal({
  channel,
  members,
  teamUsers,
  onClose,
  onSaved,
}: {
  channel: EnrichedChannel;
  members: Array<{ userId: string; name: string; role: string }>;
  teamUsers: Array<{ id: string; name: string; role: string }>;
  onClose: () => void;
  onSaved: (updated: Partial<EnrichedChannel>) => void;
}) {
  const [tab, setTab] = useState<"overview" | "permissions" | "invites">("overview");
  const [name, setName] = useState(channel.name || "");
  const [description, setDescription] = useState((channel as EnrichedChannel & { description?: string }).description || "");
  const [isPrivate, setIsPrivate] = useState((channel as EnrichedChannel & { isPrivate?: boolean }).isPrivate ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/team-chat/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPrivate }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved(updated);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] shadow-2xl w-[480px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rule)]">
          <h2 className="font-semibold text-[var(--ink)]">
            Channel Settings — #{channel.name}
          </h2>
          <button onClick={onClose} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-[var(--rule)]">
          {(["overview", "permissions", "invites"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 text-sm rounded-t-md capitalize transition-colors"
              style={{
                borderBottom: tab === t ? "2px solid var(--accent-clay)" : "2px solid transparent",
                color: tab === t ? "var(--ink)" : "var(--ink-muted)",
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1 uppercase tracking-wider">
                  Channel Name
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--rule)]">
                  <Hash className="w-4 h-4 text-[var(--ink-muted)]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-[var(--ink)]"
                    placeholder="channel-name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--rule)] text-sm text-[var(--ink)] outline-none resize-none placeholder:text-[var(--ink-muted)]"
                  placeholder="What is this channel about?"
                />
              </div>
            </div>
          )}

          {tab === "permissions" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg)] border border-[var(--rule)]">
                <div className="flex items-center gap-3">
                  {isPrivate ? (
                    <Lock className="w-5 h-5 text-[var(--accent-clay)]" />
                  ) : (
                    <Globe className="w-5 h-5 text-[var(--ink-muted)]" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {isPrivate ? "Private Channel" : "Public Channel"}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {isPrivate ? "Only invited members can see this channel" : "All team members can access this channel"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className="relative w-10 h-6 rounded-full transition-colors"
                  style={{ background: isPrivate ? "var(--accent-clay)" : "var(--rule)" }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: isPrivate ? "translateX(18px)" : "translateX(2px)" }}
                  />
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-2">
                  Members with access
                </p>
                <div className="flex flex-col gap-1">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--muted)]">
                      <Avatar userId={m.userId} name={m.name} size={28} />
                      <span className="text-sm text-[var(--ink)] flex-1">{m.name}</span>
                      <span className="text-xs text-[var(--ink-muted)]">{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "invites" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider">
                Current Members ({members.length})
              </p>
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                  <Avatar userId={m.userId} name={m.name} size={28} />
                  <span className="text-sm text-[var(--ink)] flex-1">{m.name}</span>
                  <span className="text-xs text-[var(--ink-muted)] px-2 py-0.5 rounded bg-[var(--muted)]">{m.role}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-[var(--rule)]">
                <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-2">
                  Add Members
                </p>
                <div className="flex flex-col gap-1">
                  {teamUsers
                    .filter((u) => !members.find((m) => m.userId === u.id))
                    .map((u) => (
                      <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--muted)]">
                        <Avatar userId={u.id} name={u.name} size={28} />
                        <span className="text-sm text-[var(--ink)] flex-1">{u.name}</span>
                        <button className="text-xs text-[var(--accent-clay)] flex items-center gap-1 hover:opacity-80">
                          <UserPlus className="w-3.5 h-3.5" />
                          Invite
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {tab !== "invites" && (
          <div className="flex gap-2 px-5 py-3 border-t border-[var(--rule)]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-clay)" }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-[var(--ink-muted)] bg-[var(--muted)] hover:bg-[var(--rule)] transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Plus Menu ────────────────────────────────────────────────────────────────

function PlusMenu({
  onUpload,
  onPoll,
  onAiMode,
  onEmoji,
  aiMode,
  onClose,
}: {
  onUpload: () => void;
  onPoll: () => void;
  onAiMode: () => void;
  onEmoji: () => void;
  aiMode: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      className="absolute bottom-full mb-2 left-0 z-30 rounded-xl border border-[var(--rule)] bg-[var(--bg)] shadow-xl overflow-hidden min-w-[180px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onUpload(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
      >
        <Upload className="w-4 h-4 text-[var(--ink-muted)]" />
        Upload Files
      </button>
      <button
        onClick={() => { onPoll(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
      >
        <BarChart2 className="w-4 h-4 text-[var(--ink-muted)]" />
        Create Poll
      </button>
      <button
        onClick={() => { onAiMode(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--muted)] transition-colors text-left"
        style={{ color: aiMode ? "var(--accent-clay)" : "var(--ink)" }}
      >
        <Bot className="w-4 h-4" style={{ color: aiMode ? "var(--accent-clay)" : "var(--ink-muted)" }} />
        Ask AI {aiMode && <span className="ml-auto text-xs text-[var(--accent-clay)]">ON</span>}
      </button>
      <button
        onClick={() => { onEmoji(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
      >
        <Smile className="w-4 h-4 text-[var(--ink-muted)]" />
        Emoji
      </button>
    </motion.div>
  );
}

// ─── Poll Creation Form ───────────────────────────────────────────────────────

function PollCreator({
  onSubmit,
  onCancel,
}: {
  onSubmit: (question: string, options: string[]) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => {
    if (options.length < 5) setOptions([...options, ""]);
  };

  const updateOption = (i: number, val: string) => {
    setOptions(options.map((o, idx) => (idx === i ? val : o)));
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--bg)] p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="w-4 h-4 text-[var(--accent-clay)]" />
        <span className="text-sm font-medium text-[var(--ink)]">New Poll</span>
        <button onClick={onCancel} className="ml-auto text-[var(--ink-muted)] hover:text-[var(--ink)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        autoFocus
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        className="w-full px-2 py-1.5 rounded bg-[var(--surface)] border border-[var(--rule)] text-sm text-[var(--ink)] outline-none mb-2 placeholder:text-[var(--ink-muted)]"
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1 mb-1">
          <input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="flex-1 px-2 py-1 rounded bg-[var(--surface)] border border-[var(--rule)] text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
          />
          {options.length > 2 && (
            <button onClick={() => removeOption(i)} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2">
        {options.length < 5 && (
          <button
            onClick={addOption}
            className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add option
          </button>
        )}
        <button
          onClick={() => valid && onSubmit(question, options.filter((o) => o.trim()))}
          disabled={!valid}
          className="ml-auto px-3 py-1 rounded text-xs font-medium text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent-clay)" }}
        >
          Create Poll
        </button>
      </div>
    </div>
  );
}

// ─── Emoji Grid Picker ─────────────────────────────────────────────────────────

function EmojiGridPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute bottom-full mb-2 right-0 z-30 rounded-xl border border-[var(--rule)] bg-[var(--bg)] shadow-xl p-3 w-[260px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--ink-muted)]">Emoji</span>
        <button onClick={onClose} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {Object.entries(COMMON_EMOJIS_BY_CATEGORY).map(([cat, emojis]) => (
        <div key={cat} className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] mb-1">{cat}</p>
          <div className="flex flex-wrap gap-0.5">
            {emojis.map((e) => (
              <button
                key={e}
                onClick={() => onSelect(e)}
                className="text-lg p-1 rounded hover:bg-[var(--muted)] hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Channel Context Menu ──────────────────────────────────────────────────────

function ChannelContextMenu({
  channel,
  pos,
  canManage,
  isMuted,
  onOpenChat,
  onSettings,
  onMuteToggle,
  onDelete,
  onClose,
}: {
  channel: EnrichedChannel;
  pos: { x: number; y: number };
  canManage: boolean;
  isMuted: boolean;
  onOpenChat: () => void;
  onSettings: () => void;
  onMuteToggle: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-50 rounded-xl border border-[var(--rule)] bg-[var(--bg)] shadow-2xl py-1 min-w-[200px]"
      style={{ left: Math.min(pos.x, window.innerWidth - 210), top: Math.min(pos.y, window.innerHeight - 250) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onOpenChat(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
      >
        <Hash className="w-4 h-4 text-[var(--ink-muted)]" />
        Open Chat
      </button>
      <button
        onClick={() => { onMuteToggle(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
      >
        {isMuted ? <Bell className="w-4 h-4 text-[var(--ink-muted)]" /> : <BellOff className="w-4 h-4 text-[var(--ink-muted)]" />}
        {isMuted ? "Unmute Notifications" : "Mute Notifications"}
      </button>
      {canManage && (
        <button
          onClick={() => { onSettings(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--muted)] transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-[var(--ink-muted)]" />
          Edit Channel
        </button>
      )}
      {canManage && onDelete && channel.name !== "General" && (
        <>
          <div className="h-px my-1 bg-[var(--rule)]" />
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
          >
            <Trash2 className="w-4 h-4" />
            Delete Channel
          </button>
        </>
      )}
    </motion.div>
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
    channelSettingsId,
    aiMode,
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
    setChannelSettingsId,
    setAiMode,
  } = useTeamChat();

  const [input, setInput] = useState("");
  const [editInput, setEditInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"group" | "voice">("group");
  const [showNewDm, setShowNewDm] = useState(false);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [connectedVoice, setConnectedVoice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [voiceMinimized, setVoiceMinimized] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [voiceChannelParticipants, setVoiceChannelParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const voiceClientRef = useRef<VoiceClient | null>(null);
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(new Set());
  const [channelContextMenu, setChannelContextMenu] = useState<{
    channel: EnrichedChannel;
    pos: { x: number; y: number };
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const isFounder = user?.role === "founder";
  const isManager = user?.role === "manager";
  const canManage = isFounder || isManager;

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/team-chat/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data);
        if (data.length > 0 && !activeChannelId) {
          // Default to first text channel
          const first = data.find((c: EnrichedChannel) => c.type === "group") || data[0];
          setActiveChannel(first.id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const loadPresence = () => {
      fetch("/api/team-chat/presence")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setOnlineUsers(data); })
        .catch(() => {});
    };
    loadPresence();
    const interval = setInterval(loadPresence, 15000);
    return () => clearInterval(interval);
  }, [setOnlineUsers]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/team-chat/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "online" }),
    }).catch(() => {});

    const handleVisibility = () => {
      fetch("/api/team-chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: document.hidden ? "idle" : "online" }),
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

  useEffect(() => {
    if (!activeChannelId) return;
    fetch(`/api/team-chat/channels/${activeChannelId}/members`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setChannelMembers(activeChannelId, data); })
      .catch(() => {});
  }, [activeChannelId, setChannelMembers]);

  useEffect(() => {
    if (!activeChannelId) return;
    eventSourceRef.current?.close();

    const es = new EventSource(`/api/team-chat/channels/${activeChannelId}/stream`);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as EnrichedMessage;
        addMessage(msg);
        if (msg.userId !== user?.id) incrementUnread(activeChannelId);
      } catch { /* ignore */ }
    };
    es.onerror = () => {};
    eventSourceRef.current = es;
    return () => es.close();
  }, [activeChannelId, addMessage, incrementUnread, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Close context menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setSelectedMessage(null);
      }
      setChannelContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setSelectedMessage]);

  // Close plus menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlusMenu]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const textChannels = useMemo(() => channels.filter((c) => c.type === "group"), [channels]);
  const voiceChannels = useMemo(() => channels.filter((c) => c.type === "voice"), [channels]);
  const dmChannels = useMemo(() => channels.filter((c) => c.type === "direct"), [channels]);
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const currentMembers = activeChannelId ? channelMembers[activeChannelId] || [] : [];
  const onlineMembers = currentMembers.filter((m) => {
    const p = onlineUsers.find((u) => u.userId === m.userId);
    return p?.status === "online" || p?.status === "idle" || p?.status === "dnd";
  });
  const offlineMembers = currentMembers.filter((m) => {
    const p = onlineUsers.find((u) => u.userId === m.userId);
    return !p || p.status === "offline";
  });

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return teamUsers
      .filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== user?.id)
      .slice(0, 8);
  }, [mentionQuery, teamUsers, user?.id]);

  const settingsChannel = channelSettingsId ? channels.find((c) => c.id === channelSettingsId) : null;
  const settingsMembers = channelSettingsId ? (channelMembers[channelSettingsId] || []) : [];

  // ── Voice handlers ────────────────────────────────────────────────────────────

  const handleVoiceConnect = useCallback(async (channelId: string) => {
    if (connectedVoice === channelId) {
      // Disconnect
      await voiceClientRef.current?.leave();
      voiceClientRef.current = null;
      setConnectedVoice(null);
      setVoiceParticipants([]);
      setRemoteStreams(new Map());
      setCameraOn(false);
      setScreenSharing(false);
      setMuted(false);
      setDeafened(false);
      // Clean up audio elements
      remoteAudioRefs.current.forEach((a) => { a.pause(); a.srcObject = null; });
      remoteAudioRefs.current.clear();
      return;
    }

    // Disconnect from previous channel if any
    if (voiceClientRef.current) {
      await voiceClientRef.current.leave();
      voiceClientRef.current = null;
      remoteAudioRefs.current.forEach((a) => { a.pause(); a.srcObject = null; });
      remoteAudioRefs.current.clear();
    }

    const client = new VoiceClient(channelId, user!.id);

    client.onRemoteStream = (userId, stream, type) => {
      setRemoteStreams((prev) => new Map(prev).set(userId, stream));
      if (type === "audio") {
        // Attach to an Audio element for playback
        let audio = remoteAudioRefs.current.get(userId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudioRefs.current.set(userId, audio);
        }
        audio.srcObject = stream;
        audio.muted = deafened;
        audio.play().catch(() => {});
      }
      // Video streams are attached via remoteVideoRefs when the tile mounts
    };

    client.onParticipantLeft = (userId) => {
      setRemoteStreams((prev) => {
        const m = new Map(prev);
        m.delete(userId);
        return m;
      });
      const audio = remoteAudioRefs.current.get(userId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        remoteAudioRefs.current.delete(userId);
      }
    };

    client.onParticipantsUpdate = (participants) => {
      setVoiceParticipants(participants);
    };

    voiceClientRef.current = client;
    setConnectedVoice(channelId);
    setMuted(false);
    setDeafened(false);

    try {
      await client.join();
    } catch (err) {
      console.error("Voice join failed:", err);
      voiceClientRef.current = null;
      setConnectedVoice(null);
    }
  }, [connectedVoice, user, deafened]);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    voiceClientRef.current?.setMuted(next);
  }, [muted]);

  const handleToggleDeafen = useCallback(() => {
    const next = !deafened;
    setDeafened(next);
    voiceClientRef.current?.setDeafened(next);
    // Mute/unmute all remote audio elements
    remoteAudioRefs.current.forEach((a) => { a.muted = next; });
  }, [deafened]);

  const handleToggleCamera = useCallback(async () => {
    if (!voiceClientRef.current) return;
    if (cameraOn) {
      await voiceClientRef.current.disableCamera();
      setCameraOn(false);
    } else {
      try {
        await voiceClientRef.current.enableCamera();
        setCameraOn(true);
      } catch (err) {
        console.error("Camera failed:", err);
      }
    }
  }, [cameraOn]);

  const handleToggleScreen = useCallback(async () => {
    if (!voiceClientRef.current) return;
    if (screenSharing) {
      await voiceClientRef.current.stopScreenShare();
      setScreenSharing(false);
    } else {
      try {
        await voiceClientRef.current.shareScreen();
        setScreenSharing(true);
      } catch (err) {
        console.error("Screen share failed:", err);
      }
    }
  }, [screenSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceClientRef.current?.leave();
    };
  }, []);

  // Poll voice channel participants for sidebar display (every 10s)
  useEffect(() => {
    if (voiceChannels.length === 0) return;
    const fetchParticipants = async () => {
      const results: Record<string, VoiceParticipant[]> = {};
      for (const ch of voiceChannels) {
        try {
          const res = await fetch(`/api/team-chat/channels/${ch.id}/voice`);
          const data = await res.json();
          results[ch.id] = data.participants || [];
        } catch {
          results[ch.id] = [];
        }
      }
      setVoiceChannelParticipants(results);
    };
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 10000);
    return () => clearInterval(interval);
  }, [voiceChannels]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !activeChannelId) return;

    const content = input.trim();
    setInput("");
    setSending(true);
    setAiMode(false);

    try {
      if (aiMode) {
        // Post user message + ask AI
        const body: Record<string, unknown> = { content };
        if (replyingTo) body.replyToId = replyingTo.id;
        setReplyingTo(null);

        await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // Ask AI
        const aiRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: "global", message: content }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const aiReply = aiData.response || aiData.content || aiData.message || "";
          if (aiReply) {
            await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: `**AI:** ${aiReply}` }),
            });
          }
        }
      } else {
        const body: Record<string, unknown> = { content };
        if (replyingTo) body.replyToId = replyingTo.id;
        setReplyingTo(null);

        await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, activeChannelId, replyingTo, setReplyingTo, aiMode, setAiMode]);

  const handleEditSave = useCallback(async (msgId: string) => {
    if (!editInput.trim()) return;
    try {
      const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateMessage(msgId, { content: updated.content, editedAt: updated.editedAt });
      }
    } catch { /* */ }
    setEditingMessageId(null);
    setEditInput("");
  }, [editInput, activeChannelId, updateMessage, setEditingMessageId]);

  const handleDelete = useCallback(async (msgId: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages/${msgId}`, { method: "DELETE" });
      if (res.ok) deleteMessage(msgId);
    } catch { /* */ }
    setSelectedMessage(null);
  }, [activeChannelId, deleteMessage, setSelectedMessage]);

  const handlePin = useCallback(async (msgId: string) => {
    try {
      await fetch(`/api/team-chat/channels/${activeChannelId}/messages/${msgId}/pin`, { method: "POST" });
      const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch { /* */ }
    setSelectedMessage(null);
  }, [activeChannelId, setMessages, setSelectedMessage]);

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    try {
      await fetch(`/api/team-chat/channels/${activeChannelId}/messages/${msgId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages/${msgId}/react`);
      const data = await res.json();
      if (Array.isArray(data)) setReactions(msgId, data);
    } catch { /* */ }
    setShowEmojiPicker(false);
    setSelectedMessage(null);
  }, [activeChannelId, setReactions, setShowEmojiPicker, setSelectedMessage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (uploadRes.ok) {
        const { url, mediaType } = await uploadRes.json();
        await fetch(`/api/team-chat/channels/${activeChannelId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "", mediaUrl: url, mediaType }),
        });
      }
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
      body: JSON.stringify({ type: newChannelType, name: newChannelName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      const newChannels = await fetch("/api/team-chat/channels").then((r) => r.json());
      setChannels(newChannels);
      if (newChannelType === "group") setActiveChannel(data.id);
    }
    setShowNewChannel(false);
    setNewChannelName("");
    setNewChannelType("group");
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

  const handleDeleteChannel = async (id: string) => {
    if (!confirm("Delete channel?")) return;
    const res = await fetch(`/api/team-chat/channels/${id}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await fetch("/api/team-chat/channels").then((r) => r.json());
      setChannels(updated);
      if (activeChannelId === id) setActiveChannel(updated[0]?.id || null);
    }
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    if (!activeChannelId) return;
    setShowPollCreator(false);
    try {
      await fetch("/api/team-chat/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeChannelId, question, options }),
      });
    } catch { /* */ }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const sel = mentionSuggestions[mentionIndex];
        if (sel) {
          const atIdx = input.lastIndexOf("@");
          setInput(input.slice(0, atIdx) + `@${sel.name} `);
          setMentionQuery(null);
          setMentionIndex(0);
        }
        return;
      }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ")) { setMentionQuery(afterAt); setMentionIndex(0); return; }
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
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
  };

  const onContextMenu = (e: React.MouseEvent, msg: EnrichedMessage) => {
    e.preventDefault();
    setSelectedMessage(msg, { x: e.clientX, y: e.clientY });
  };

  const handleChannelRightClick = (e: React.MouseEvent, ch: EnrichedChannel) => {
    e.preventDefault();
    e.stopPropagation();
    setChannelContextMenu({ channel: ch, pos: { x: e.clientX, y: e.clientY } });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen overflow-hidden bg-[var(--surface)] text-[var(--ink)]"
      onClick={() => {
        if (selectedMessage) setSelectedMessage(null);
        if (showEmojiPicker) setShowEmojiPicker(false);
        setChannelContextMenu(null);
      }}
    >
      {/* ── Left Sidebar ── */}
      <div className="flex flex-col shrink-0 overflow-hidden w-60 bg-[var(--bg)] border-r border-[var(--rule)]">
        {/* Server header */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0 font-semibold text-sm border-b border-[var(--rule)]">
          <span className="text-[var(--ink)]">Adchemy Team</span>
          <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />
        </div>

        <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin" }}>
          {/* DMs */}
          {dmChannels.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Direct Messages
              </div>
              {dmChannels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  active={ch.id === activeChannelId}
                  icon={<AtSign className="w-4 h-4" strokeWidth={1.5} />}
                  onSelect={() => setActiveChannel(ch.id)}
                  onRightClick={(e) => handleChannelRightClick(e, ch)}
                  onSettings={() => setChannelSettingsId(ch.id)}
                  canManage={canManage}
                />
              ))}
              <button
                onClick={() => setShowNewDm(!showNewDm)}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New DM</span>
              </button>
            </div>
          )}

          {/* Text Channels */}
          <div className="mb-2">
            <button
              className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
              onClick={() => setTextChannelsOpen((v) => !v)}
            >
              {textChannelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Text Channels</span>
              {canManage && (
                <button
                  className="ml-auto p-0.5 rounded hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); setShowNewChannel(true); setNewChannelType("group"); }}
                  title="Create channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </button>

            {textChannelsOpen && textChannels.map((ch) => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                active={ch.id === activeChannelId}
                icon={<Hash className="w-4 h-4" strokeWidth={1.5} />}
                onSelect={() => setActiveChannel(ch.id)}
                onRightClick={(e) => handleChannelRightClick(e, ch)}
                onSettings={() => setChannelSettingsId(ch.id)}
                canManage={canManage}
                isMuted={mutedChannels.has(ch.id)}
              />
            ))}
          </div>

          {/* Voice Channels */}
          <div className="mb-2">
            <button
              className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
              onClick={() => setVoiceChannelsOpen((v) => !v)}
            >
              {voiceChannelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Voice Channels</span>
              {canManage && (
                <button
                  className="ml-auto p-0.5 rounded hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); setShowNewChannel(true); setNewChannelType("voice"); }}
                  title="Create voice channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </button>
            {voiceChannelsOpen && voiceChannels.map((ch) => (
              <div key={ch.id}>
                <ChannelItem
                  channel={ch}
                  active={connectedVoice === ch.id}
                  icon={<Volume2 className="w-4 h-4" strokeWidth={1.5} />}
                  onSelect={() => handleVoiceConnect(ch.id)}
                  onRightClick={(e) => handleChannelRightClick(e, ch)}
                  onSettings={() => setChannelSettingsId(ch.id)}
                  canManage={canManage}
                  isVoice
                />
                {/* Participant list under voice channel */}
                {(voiceChannelParticipants[ch.id] || []).length > 0 && (
                  <div className="pl-7 pb-1 flex flex-col gap-0.5">
                    {(voiceChannelParticipants[ch.id] || []).map((p) => (
                      <div key={p.userId} className="flex items-center gap-1.5 text-xs py-0.5 text-[var(--ink-muted)]">
                        <span
                          style={{
                            display: "inline-block", width: 7, height: 7,
                            borderRadius: "50%", flexShrink: 0,
                            background: p.muted ? "#f0b132" : "#23a55a",
                          }}
                        />
                        <span className="truncate">{p.userId === user?.id ? `${p.name} (you)` : p.name}</span>
                        {p.muted && <MicOff className="w-2.5 h-2.5 shrink-0 opacity-60" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {voiceChannelsOpen && voiceChannels.length === 0 && (
              <p className="text-xs text-[var(--ink-muted)] px-4 py-1">No voice channels</p>
            )}
          </div>

          {/* Add DM button if no DMs yet */}
          {dmChannels.length === 0 && (
            <button
              onClick={() => setShowNewDm(!showNewDm)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm w-full text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
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
              className="px-3 py-2 overflow-hidden border-t border-[var(--rule)]"
            >
              <p className="text-xs mb-1 text-[var(--ink-muted)]">
                {newChannelType === "voice" ? "Create Voice Channel" : "Create Text Channel"}
              </p>
              {/* Type selector */}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setNewChannelType("group")}
                  className="flex-1 py-1 rounded text-xs flex items-center justify-center gap-1"
                  style={{
                    background: newChannelType === "group" ? "var(--accent-clay)" : "var(--muted)",
                    color: newChannelType === "group" ? "#fff" : "var(--ink-muted)",
                  }}
                >
                  <Hash className="w-3 h-3" /> Text
                </button>
                <button
                  onClick={() => setNewChannelType("voice")}
                  className="flex-1 py-1 rounded text-xs flex items-center justify-center gap-1"
                  style={{
                    background: newChannelType === "voice" ? "var(--accent-clay)" : "var(--muted)",
                    color: newChannelType === "voice" ? "#fff" : "var(--ink-muted)",
                  }}
                >
                  <Volume2 className="w-3 h-3" /> Voice
                </button>
              </div>
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateChannel();
                  if (e.key === "Escape") setShowNewChannel(false);
                }}
                placeholder="channel-name"
                className="w-full rounded px-2 py-1 text-sm outline-none bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={handleCreateChannel}
                  className="flex-1 py-1 rounded text-xs font-medium text-white"
                  style={{ background: "var(--accent-clay)" }}
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewChannel(false); setNewChannelName(""); }}
                  className="flex-1 py-1 rounded text-xs font-medium bg-[var(--muted)] text-[var(--ink-muted)]"
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
              className="px-3 py-2 overflow-hidden border-t border-[var(--rule)]"
            >
              <p className="text-xs mb-1 text-[var(--ink-muted)]">New Direct Message</p>
              <div className="max-h-40 overflow-y-auto">
                {teamUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleCreateDm(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left text-[var(--ink)] hover:bg-[var(--muted)] transition-colors"
                    >
                      <Avatar userId={u.id} name={u.name} size={24} />
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setShowNewDm(false)}
                className="w-full mt-1 py-0.5 rounded text-xs text-[var(--ink-muted)]"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User info bar at bottom */}
        {user && (
          <div className="flex items-center gap-2 px-2 py-2 shrink-0 bg-[var(--bg)] border-t border-[var(--rule)]">
            <div className="relative">
              <Avatar userId={user.id} name={user.name} size={32} />
              <span
                className="absolute -bottom-0.5 -right-0.5"
                style={{ width: 12, height: 12, borderRadius: "50%", background: "#23a55a", border: "2px solid var(--bg)" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-[var(--ink)]">{user.name}</p>
              <p className="text-xs truncate text-[var(--ink-muted)]">{user.role}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted(!muted)}
                className="p-1 rounded"
                title={muted ? "Unmute" : "Mute"}
                style={{ color: muted ? "#f23f43" : "var(--ink-muted)" }}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setDeafened(!deafened)}
                className="p-1 rounded"
                title={deafened ? "Undeafen" : "Deafen"}
                style={{ color: deafened ? "#f23f43" : "var(--ink-muted)" }}
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
        <div className="flex items-center justify-between px-4 h-12 shrink-0 bg-[var(--surface)] border-b border-[var(--rule)] z-10">
          <div className="flex items-center gap-2">
            {activeChannel?.type === "group" ? (
              <Hash className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={2} />
            ) : activeChannel?.type === "direct" ? (
              <AtSign className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={2} />
            ) : activeChannel?.type === "voice" ? (
              <Volume2 className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={2} />
            ) : null}
            <span className="font-semibold text-sm text-[var(--ink)]">
              {activeChannel ? (activeChannel.displayName || activeChannel.name || "Direct Message") : "Select a channel"}
            </span>
            {aiMode && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "var(--accent-clay)" }}>
                <Bot className="w-3 h-3" /> AI Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canManage && activeChannelId && (
              <button
                onClick={() => setChannelSettingsId(activeChannelId)}
                className="p-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                title="Channel settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleMemberList}
              className="p-1.5 rounded transition-colors"
              title="Toggle member list"
              style={{ color: showMemberList ? "var(--ink)" : "var(--ink-muted)" }}
            >
              <Users className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voice connection bar (minimized) */}
        <AnimatePresence>
          {connectedVoice && voiceMinimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 36 }}
              exit={{ height: 0 }}
              className="flex items-center justify-between px-4 overflow-hidden shrink-0 border-b border-[var(--rule)]"
              style={{ background: "#23a55a22" }}
            >
              <div className="flex items-center gap-2 text-sm" style={{ color: "#23a55a" }}>
                <Volume2 className="w-4 h-4" />
                <span>Connected — {channels.find((c) => c.id === connectedVoice)?.name || "Voice"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleToggleMute} className="p-1 rounded" style={{ color: muted ? "#f23f43" : "#23a55a" }}>
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button onClick={handleToggleDeafen} className="p-1 rounded" style={{ color: deafened ? "#f23f43" : "#23a55a" }}>
                  <Headphones className="w-4 h-4" />
                </button>
                <button onClick={() => setVoiceMinimized(false)} className="p-1 rounded" style={{ color: "var(--ink-muted)" }}>
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleVoiceConnect(connectedVoice)} className="p-1 rounded" style={{ color: "#f23f43" }}>
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {!activeChannelId && (
            <div className="h-full flex items-center justify-center text-[var(--ink-muted)]">
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
                style={{ background: "var(--accent-clay)" }}
              >
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-1 text-[var(--ink)]">
                Welcome to #{activeChannel?.name || "channel"}!
              </h2>
              <p className="text-sm text-[var(--ink-muted)]">
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

            // Poll detection
            const pollMatch = msg.content?.match(/^\[POLL:([a-z0-9-]+)\]$/);

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-[var(--rule)]" />
                    <span className="text-xs font-medium text-[var(--ink-muted)]">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-[var(--rule)]" />
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
                      msg.pinnedAt ? "rgba(250,166,26,0.09)" : "var(--muted)";
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
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 mt-1 select-none text-[var(--ink-muted)]">
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-medium text-sm text-[var(--ink)]">
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
                        <span className="text-xs text-[var(--ink-muted)]">{formatTime(msg.createdAt)}</span>
                        {msg.pinnedAt && <Pin className="w-3 h-3" style={{ color: "#f0b132" }} />}
                      </div>
                    )}

                    {/* Reply preview */}
                    {msg.replyToId && (
                      <ReplyPreview replyToId={msg.replyToId} messages={messages} />
                    )}

                    {/* Edit mode */}
                    {editingMessageId === msg.id ? (
                      <div>
                        <textarea
                          ref={editInputRef}
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                            if (e.key === "Escape") { setEditingMessageId(null); setEditInput(""); }
                          }}
                          className="w-full rounded px-3 py-2 text-sm resize-none outline-none bg-[var(--bg)] border text-[var(--ink)]"
                          style={{ borderColor: "var(--accent-clay)" }}
                          rows={2}
                          autoFocus
                        />
                        <p className="text-xs mt-1 text-[var(--ink-muted)]">Enter to save · Esc to cancel</p>
                      </div>
                    ) : (
                      <>
                        {pollMatch ? (
                          <PollMessage pollId={pollMatch[1]} currentUserId={user?.id} />
                        ) : (
                          <>
                            {msg.content && (
                              <p className="text-sm whitespace-pre-wrap break-words text-[var(--ink)]">
                                {msg.content}
                                {msg.editedAt && (
                                  <span className="text-xs ml-1 text-[var(--ink-muted)]">(edited)</span>
                                )}
                              </p>
                            )}
                          </>
                        )}
                        {msg.mediaUrl && msg.mediaType === "image" && (
                          <img src={msg.mediaUrl} alt="" className="max-w-sm rounded-md mt-1 border border-[var(--rule)]" />
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
                            onClick={(e) => { e.stopPropagation(); handleReact(msg.id, r.emoji); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border"
                            style={{
                              background: r.hasMe ? "rgba(var(--accent-clay-rgb, 200,100,60), 0.15)" : "var(--bg)",
                              borderColor: r.hasMe ? "var(--accent-clay)" : "var(--rule)",
                              color: "var(--ink)",
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
                    className="absolute right-2 top-0 hidden group-hover:flex items-center gap-1 rounded px-1 py-0.5 z-10 bg-[var(--bg)] border border-[var(--rule)]"
                    style={{ top: "-1px", transform: "translateY(-50%)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(true, msg.id); }}
                      className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      title="Add reaction"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); inputRef.current?.focus(); }}
                      className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                    {isOwn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditInput(msg.content); setEditingMessageId(msg.id); }}
                        className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg, { x: e.clientX, y: e.clientY }); }}
                      className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]"
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
                        className="absolute right-2 z-20 rounded-lg p-2 flex gap-1 bg-[var(--bg)] border border-[var(--rule)]"
                        style={{ top: "100%", marginTop: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="text-lg hover:scale-125 transition-transform"
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
          <div className="px-4 pb-4 pt-2 shrink-0 bg-[var(--surface)]">
            {/* Reply preview bar */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-lg overflow-hidden bg-[var(--bg)]"
                >
                  <Reply className="w-3.5 h-3.5 shrink-0 text-[var(--ink-muted)]" />
                  <span className="text-xs text-[var(--ink-muted)]">
                    Replying to{" "}
                    <span className="text-[var(--ink)] font-medium">{replyingTo.userName || "Unknown"}</span>
                    {" – "}
                    <span className="truncate">{replyingTo.content?.slice(0, 60)}</span>
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="ml-auto text-[var(--ink-muted)] hover:text-[var(--ink)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Poll creator */}
            <AnimatePresence>
              {showPollCreator && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <PollCreator
                    onSubmit={handleCreatePoll}
                    onCancel={() => setShowPollCreator(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI mode banner */}
            <AnimatePresence>
              {aiMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-lg overflow-hidden"
                  style={{ background: "rgba(var(--accent-clay-rgb, 200,100,60), 0.12)", borderTop: "1px solid var(--accent-clay)" }}
                >
                  <Bot className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-clay)" }} />
                  <span className="text-xs" style={{ color: "var(--accent-clay)" }}>
                    AI mode active — your next message will be answered by AI
                  </span>
                  <button
                    onClick={() => setAiMode(false)}
                    className="ml-auto"
                    style={{ color: "var(--accent-clay)" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Format toolbar */}
            <div className="flex items-center gap-1 px-3 py-1 rounded-t-lg bg-[var(--bg)]">
              <button onClick={() => insertFormat("**")} className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Bold">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertFormat("*")} className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Italic">
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertFormat("`")} className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Code">
                <Code className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertFormat("~~")} className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Strikethrough">
                <span className="text-xs font-medium line-through">S</span>
              </button>
              <div className="w-px h-4 mx-1 bg-[var(--rule)]" />
              <button onClick={() => insertFormat("||")} className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)]" title="Spoiler">
                <span className="text-xs font-medium">||</span>
              </button>
            </div>

            {/* Main input row */}
            <div className="flex items-end gap-2 px-3 py-2 rounded-b-lg bg-[var(--bg)]">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />

              {/* + button with popup menu */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPlusMenu(!showPlusMenu); }}
                  className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                  title="More options"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {showPlusMenu && (
                    <PlusMenu
                      onUpload={() => fileInputRef.current?.click()}
                      onPoll={() => setShowPollCreator(true)}
                      onAiMode={() => setAiMode(!aiMode)}
                      onEmoji={() => setShowEmojiGrid(true)}
                      aiMode={aiMode}
                      onClose={() => setShowPlusMenu(false)}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 relative">
                {/* Mention autocomplete */}
                <AnimatePresence>
                  {mentionSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full mb-1 left-0 right-0 rounded-lg overflow-hidden z-20 border border-[var(--rule)] bg-[var(--bg)]"
                    >
                      {mentionSuggestions.map((u, idx) => (
                        <button
                          key={u.id}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[var(--ink)] transition-colors"
                          style={{ background: idx === mentionIndex ? "var(--muted)" : "transparent" }}
                          onClick={() => {
                            const atIdx = input.lastIndexOf("@");
                            setInput(input.slice(0, atIdx) + `@${u.name} `);
                            setMentionQuery(null);
                            inputRef.current?.focus();
                          }}
                        >
                          <Avatar userId={u.id} name={u.name} size={24} />
                          <span>{u.name}</span>
                          <span className="text-xs ml-auto text-[var(--ink-muted)]">{u.role}</span>
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
                  className="w-full resize-none outline-none text-sm bg-transparent text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
                  style={{ maxHeight: 120, lineHeight: 1.5 }}
                  onInput={(e) => {
                    const ta = e.currentTarget;
                    ta.style.height = "auto";
                    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
                  }}
                />
              </div>

              {/* Emoji button with grid picker */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEmojiGrid(!showEmojiGrid); }}
                  className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {showEmojiGrid && (
                    <EmojiGridPicker
                      onSelect={(emoji) => {
                        setInput((v) => v + emoji);
                        setShowEmojiGrid(false);
                        inputRef.current?.focus();
                      }}
                      onClose={() => setShowEmojiGrid(false)}
                    />
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="p-1.5 rounded transition-all"
                style={{
                  background: input.trim() ? "var(--accent-clay)" : "transparent",
                  color: input.trim() ? "#fff" : "var(--ink-muted)",
                }}
                title="Send"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
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
            className="shrink-0 overflow-hidden bg-[var(--bg)] border-l border-[var(--rule)]"
          >
            <div className="w-[240px] h-full overflow-y-auto py-4 px-2" style={{ scrollbarWidth: "thin" }}>
              {onlineMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1 text-[var(--ink-muted)]">
                    Online — {onlineMembers.length}
                  </p>
                  {onlineMembers.map((m) => {
                    const presence = onlineUsers.find((u) => u.userId === m.userId);
                    return (
                      <MemberRow key={m.userId} member={m} status={presence?.status || "online"} isCurrentUser={m.userId === user?.id} />
                    );
                  })}
                </div>
              )}

              {offlineMembers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1 text-[var(--ink-muted)]">
                    Offline — {offlineMembers.length}
                  </p>
                  {offlineMembers.map((m) => (
                    <MemberRow key={m.userId} member={m} status="offline" isCurrentUser={m.userId === user?.id} />
                  ))}
                </div>
              )}

              {currentMembers.length === 0 && (
                <p className="text-xs px-2 text-[var(--ink-muted)]">No members</p>
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
            className="fixed z-50 rounded-xl py-1 min-w-[180px] border bg-[var(--bg)] border-[var(--rule)]"
            style={{
              left: Math.min(contextMenuPos.x, window.innerWidth - 200),
              top: Math.min(contextMenuPos.y, window.innerHeight - 300),
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem
              icon={<Smile className="w-4 h-4" />}
              label="Add Reaction"
              onClick={() => { setShowEmojiPicker(true, selectedMessage.id); setSelectedMessage(null); }}
            />
            <ContextMenuItem
              icon={<Reply className="w-4 h-4" />}
              label="Reply"
              onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); inputRef.current?.focus(); }}
            />
            {selectedMessage.userId === user?.id && (
              <ContextMenuItem
                icon={<Pencil className="w-4 h-4" />}
                label="Edit Message"
                onClick={() => { setEditInput(selectedMessage.content); setEditingMessageId(selectedMessage.id); setSelectedMessage(null); }}
              />
            )}
            {canManage && (
              <ContextMenuItem
                icon={<Pin className="w-4 h-4" />}
                label={selectedMessage.pinnedAt ? "Unpin Message" : "Pin Message"}
                onClick={() => handlePin(selectedMessage.id)}
              />
            )}
            <div className="h-px my-1 bg-[var(--rule)]" />
            <ContextMenuItem
              icon={<Check className="w-4 h-4" />}
              label="Copy Text"
              onClick={() => { navigator.clipboard.writeText(selectedMessage.content).catch(() => {}); setSelectedMessage(null); }}
            />
            {(selectedMessage.userId === user?.id || isFounder) && (
              <>
                <div className="h-px my-1 bg-[var(--rule)]" />
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

      {/* ── Channel Context Menu ── */}
      <AnimatePresence>
        {channelContextMenu && (
          <ChannelContextMenu
            channel={channelContextMenu.channel}
            pos={channelContextMenu.pos}
            canManage={canManage}
            isMuted={mutedChannels.has(channelContextMenu.channel.id)}
            onOpenChat={() => setActiveChannel(channelContextMenu.channel.id)}
            onSettings={() => setChannelSettingsId(channelContextMenu.channel.id)}
            onMuteToggle={() =>
              setMutedChannels((prev) => {
                const next = new Set(prev);
                if (next.has(channelContextMenu.channel.id)) next.delete(channelContextMenu.channel.id);
                else next.add(channelContextMenu.channel.id);
                return next;
              })
            }
            onDelete={() => handleDeleteChannel(channelContextMenu.channel.id)}
            onClose={() => setChannelContextMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Channel Settings Modal ── */}
      <AnimatePresence>
        {settingsChannel && (
          <ChannelSettingsModal
            channel={settingsChannel}
            members={settingsMembers}
            teamUsers={teamUsers}
            onClose={() => setChannelSettingsId(null)}
            onSaved={(updated) => {
              setChannels(channels.map((c) => c.id === settingsChannel.id ? { ...c, ...updated } : c));
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Voice Overlay Panel ── */}
      <AnimatePresence>
        {connectedVoice && !voiceMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            style={{
              position: "fixed",
              bottom: 80,
              right: 20,
              width: 360,
              zIndex: 200,
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: 14,
              boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: "#23a55a22", borderBottom: "1px solid var(--rule)" }}
            >
              <div className="flex items-center gap-2" style={{ color: "#23a55a" }}>
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  {channels.find((c) => c.id === connectedVoice)?.name || "Voice"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVoiceMinimized(true)}
                  className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
                  style={{ color: "var(--ink-muted)" }}
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleVoiceConnect(connectedVoice)}
                  className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
                  style={{ color: "#f23f43" }}
                  title="Disconnect"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Participant grid */}
            <div className="p-3 flex flex-wrap gap-2">
              {voiceParticipants.length === 0 ? (
                <p className="text-xs text-[var(--ink-muted)] w-full text-center py-2">
                  Connecting...
                </p>
              ) : (
                voiceParticipants.map((p) => {
                  const videoStream = remoteStreams.get(p.userId);
                  const isMe = p.userId === user?.id;
                  return (
                    <div
                      key={p.userId}
                      style={{
                        width: 76,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          overflow: "hidden",
                          position: "relative",
                          border: "2px solid",
                          borderColor: p.muted ? "#80848e" : "#23a55a",
                          flexShrink: 0,
                        }}
                      >
                        {videoStream && !isMe ? (
                          <video
                            ref={(el) => {
                              if (el) {
                                remoteVideoRefs.current.set(p.userId, el);
                                if (el.srcObject !== videoStream) {
                                  el.srcObject = videoStream;
                                  el.play().catch(() => {});
                                }
                              }
                            }}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%", height: "100%",
                              background: avatarColor(p.userId),
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 18, fontWeight: 700, color: "#fff",
                            }}
                          >
                            {initials(p.name)}
                          </div>
                        )}
                        {p.muted && (
                          <div
                            style={{
                              position: "absolute", bottom: 2, right: 2,
                              background: "rgba(0,0,0,0.7)", borderRadius: "50%",
                              width: 16, height: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <MicOff style={{ width: 10, height: 10, color: "#f23f43" }} />
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11, color: "var(--ink-muted)",
                          maxWidth: 72, textAlign: "center",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {isMe ? "You" : p.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Controls */}
            <div
              className="flex items-center justify-center gap-2 px-4 py-3"
              style={{ borderTop: "1px solid var(--rule)" }}
            >
              {/* Mute */}
              <button
                onClick={handleToggleMute}
                title={muted ? "Unmute" : "Mute"}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ color: muted ? "#f23f43" : "var(--ink-muted)", minWidth: 48 }}
              >
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span style={{ fontSize: 10 }}>{muted ? "Unmute" : "Mute"}</span>
              </button>

              {/* Deafen */}
              <button
                onClick={handleToggleDeafen}
                title={deafened ? "Undeafen" : "Deafen"}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ color: deafened ? "#f23f43" : "var(--ink-muted)", minWidth: 48 }}
              >
                <Headphones className="w-5 h-5" />
                <span style={{ fontSize: 10 }}>{deafened ? "Undeafen" : "Deafen"}</span>
              </button>

              {/* Camera */}
              <button
                onClick={handleToggleCamera}
                title={cameraOn ? "Camera Off" : "Camera On"}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ color: cameraOn ? "#23a55a" : "var(--ink-muted)", minWidth: 48 }}
              >
                {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                <span style={{ fontSize: 10 }}>Camera</span>
              </button>

              {/* Screen share */}
              <button
                onClick={handleToggleScreen}
                title={screenSharing ? "Stop Share" : "Share Screen"}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ color: screenSharing ? "#23a55a" : "var(--ink-muted)", minWidth: 48 }}
              >
                {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                <span style={{ fontSize: 10 }}>Screen</span>
              </button>

              {/* Disconnect */}
              <button
                onClick={() => handleVoiceConnect(connectedVoice)}
                title="Disconnect"
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                style={{ color: "#f23f43", minWidth: 48 }}
              >
                <PhoneOff className="w-5 h-5" />
                <span style={{ fontSize: 10 }}>Leave</span>
              </button>
            </div>
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
  onRightClick,
  onSettings,
  canManage,
  isMuted,
  isVoice,
}: {
  channel: EnrichedChannel;
  active: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onSettings?: () => void;
  canManage?: boolean;
  isMuted?: boolean;
  isVoice?: boolean;
}) {
  const [hover, setHover] = useState(false);

  const displayName = channel.displayName || channel.name || "Direct Message";

  return (
    <button
      onClick={onSelect}
      onContextMenu={onRightClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md mx-1 group text-sm transition-colors"
      style={{
        width: "calc(100% - 8px)",
        background: active ? "rgba(255,255,255,0.1)" : hover ? "var(--muted)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-muted)",
      }}
    >
      <span style={{ color: active ? "var(--ink)" : "var(--ink-muted)" }}>{icon}</span>
      <span className="flex-1 truncate text-left">{displayName}</span>
      {isMuted && <BellOff className="w-3 h-3 text-[var(--ink-muted)] opacity-60" />}
      {(channel.unread ?? 0) > 0 && (
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "#f23f43" }}>
          {(channel.unread ?? 0) > 9 ? "9+" : channel.unread}
        </span>
      )}
      {hover && canManage && !isVoice && onSettings && (
        <button
          onClick={(e) => { e.stopPropagation(); onSettings(); }}
          className="p-0.5 rounded opacity-60 hover:opacity-100 text-[var(--ink-muted)]"
          title="Channel settings"
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
  const statusColors: Record<string, string> = {
    online: "#23a55a",
    idle: "#f0b132",
    dnd: "#f23f43",
    offline: "#80848e",
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-default" style={{ opacity: status === "offline" ? 0.5 : 1 }}>
      <div className="relative">
        <Avatar userId={member.userId} name={member.name} size={32} />
        <span
          className="absolute -bottom-0.5 -right-0.5"
          style={{
            width: 12, height: 12, borderRadius: "50%",
            background: statusColors[status] || "#80848e",
            border: "2px solid var(--bg)",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-[var(--ink)]">
          {member.name}
          {isCurrentUser && <span className="text-xs ml-1 text-[var(--ink-muted)]">(you)</span>}
        </p>
        <p className="text-xs truncate text-[var(--ink-muted)]">{member.role}</p>
      </div>
    </div>
  );
}

function ReplyPreview({ replyToId, messages }: { replyToId: string; messages: EnrichedMessage[] }) {
  const original = messages.find((m) => m.id === replyToId);
  if (!original) return null;

  return (
    <div className="flex items-center gap-1 mb-1 pl-2 text-xs rounded border-l-2 border-[var(--ink-muted)] text-[var(--ink-muted)]">
      <Reply className="w-3 h-3 shrink-0" />
      <span className="font-medium text-[var(--ink)]">{original.userName || "Unknown"}</span>
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
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
      style={{
        color: danger ? "#f23f43" : "var(--ink)",
        background: hover ? (danger ? "rgba(242,63,67,0.1)" : "var(--muted)") : "transparent",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
