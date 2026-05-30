import { create } from "zustand";
import type { ChatChannel, ChatMessage } from "@/db/schema";

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  hasMe: boolean;
}

export interface ChannelMember {
  userId: string;
  name: string;
  role: string;
  status: "online" | "idle" | "dnd" | "offline";
  lastSeenAt: string | null;
  joinedAt: string;
}

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  status: "online" | "idle" | "dnd" | "offline";
  lastSeenAt: string | null;
}

export type EnrichedMessage = ChatMessage & {
  userName?: string;
  userRole?: string;
  reactions?: ReactionGroup[];
  replyTo?: { id: string; content: string; userName: string } | null;
};

export type EnrichedChannel = ChatChannel & {
  unread?: number;
  displayName?: string;
};

export interface PollData {
  id: string;
  channelId: string;
  messageId: string;
  question: string;
  options: string[];
  voteCounts: number[];
  totalVotes: number;
  myVote: number | null;
  createdAt: string;
}

interface TeamChatState {
  activeChannelId: string | null;
  channels: EnrichedChannel[];
  messages: EnrichedMessage[];
  reactions: Record<string, ReactionGroup[]>; // messageId -> reactions
  typingUsers: Record<string, string[]>; // channelId -> userNames typing
  onlineUsers: PresenceUser[];
  channelMembers: Record<string, ChannelMember[]>; // channelId -> members
  pinnedMessages: Record<string, EnrichedMessage[]>; // channelId -> pinned
  selectedMessage: EnrichedMessage | null; // for context menu
  contextMenuPos: { x: number; y: number } | null;
  replyingTo: EnrichedMessage | null;
  editingMessageId: string | null;
  showMemberList: boolean;
  showEmojiPicker: boolean;
  emojiPickerMessageId: string | null;
  // Channel settings modal
  channelSettingsId: string | null;
  // AI mode
  aiMode: boolean;
  // Polls cache
  polls: Record<string, PollData>; // pollId -> poll

  // Actions
  setActiveChannel: (id: string | null) => void;
  setChannels: (channels: EnrichedChannel[]) => void;
  setMessages: (messages: EnrichedMessage[]) => void;
  addMessage: (message: EnrichedMessage) => void;
  updateMessage: (id: string, updates: Partial<EnrichedMessage>) => void;
  deleteMessage: (id: string) => void;
  setReactions: (messageId: string, reactions: ReactionGroup[]) => void;
  setTypingUsers: (channelId: string, users: string[]) => void;
  setOnlineUsers: (users: PresenceUser[]) => void;
  setChannelMembers: (channelId: string, members: ChannelMember[]) => void;
  setPinnedMessages: (channelId: string, messages: EnrichedMessage[]) => void;
  setSelectedMessage: (msg: EnrichedMessage | null, pos?: { x: number; y: number } | null) => void;
  setReplyingTo: (msg: EnrichedMessage | null) => void;
  setEditingMessageId: (id: string | null) => void;
  toggleMemberList: () => void;
  setShowEmojiPicker: (show: boolean, messageId?: string | null) => void;
  markChannelRead: (channelId: string) => void;
  incrementUnread: (channelId: string) => void;
  setChannelSettingsId: (id: string | null) => void;
  setAiMode: (on: boolean) => void;
  setPoll: (pollId: string, data: PollData) => void;
}

export const useTeamChat = create<TeamChatState>((set) => ({
  activeChannelId: null,
  channels: [],
  messages: [],
  reactions: {},
  typingUsers: {},
  onlineUsers: [],
  channelMembers: {},
  pinnedMessages: {},
  selectedMessage: null,
  contextMenuPos: null,
  replyingTo: null,
  editingMessageId: null,
  showMemberList: true,
  showEmojiPicker: false,
  emojiPickerMessageId: null,
  channelSettingsId: null,
  aiMode: false,
  polls: {},

  setActiveChannel: (id) => set({ activeChannelId: id, replyingTo: null, editingMessageId: null }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => {
      // Avoid duplicates
      if (state.messages.find((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    }),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  deleteMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  setReactions: (messageId, reactions) =>
    set((state) => ({
      reactions: { ...state.reactions, [messageId]: reactions },
    })),
  setTypingUsers: (channelId, users) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [channelId]: users },
    })),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setChannelMembers: (channelId, members) =>
    set((state) => ({
      channelMembers: { ...state.channelMembers, [channelId]: members },
    })),
  setPinnedMessages: (channelId, messages) =>
    set((state) => ({
      pinnedMessages: { ...state.pinnedMessages, [channelId]: messages },
    })),
  setSelectedMessage: (msg, pos = null) =>
    set({ selectedMessage: msg, contextMenuPos: pos }),
  setReplyingTo: (msg) => set({ replyingTo: msg }),
  setEditingMessageId: (id) => set({ editingMessageId: id }),
  toggleMemberList: () => set((state) => ({ showMemberList: !state.showMemberList })),
  setShowEmojiPicker: (show, messageId = null) =>
    set({ showEmojiPicker: show, emojiPickerMessageId: messageId ?? null }),
  markChannelRead: (channelId) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, unread: 0 } : c
      ),
    })),
  incrementUnread: (channelId) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, unread: (c.unread ?? 0) + 1 } : c
      ),
    })),
  setChannelSettingsId: (id) => set({ channelSettingsId: id }),
  setAiMode: (on) => set({ aiMode: on }),
  setPoll: (pollId, data) =>
    set((state) => ({ polls: { ...state.polls, [pollId]: data } })),
}));
