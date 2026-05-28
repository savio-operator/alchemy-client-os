import { create } from "zustand";
import type { ChatChannel, ChatMessage } from "@/db/schema";

interface TeamChatState {
  activeChannelId: string | null;
  channels: (ChatChannel & { unread?: number })[];
  messages: (ChatMessage & { userName?: string })[];
  setActiveChannel: (id: string | null) => void;
  setChannels: (channels: (ChatChannel & { unread?: number })[]) => void;
  setMessages: (messages: (ChatMessage & { userName?: string })[]) => void;
  addMessage: (message: ChatMessage & { userName?: string }) => void;
}

export const useTeamChat = create<TeamChatState>((set) => ({
  activeChannelId: null,
  channels: [],
  messages: [],
  setActiveChannel: (id) => set({ activeChannelId: id }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));
