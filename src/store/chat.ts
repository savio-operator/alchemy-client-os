import { create } from "zustand";

interface Conversation {
  id: string;
  clientId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
  toolCalls?: string | null;
  createdAt: string;
}

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Message[];
  showList: boolean;

  setActiveConversation: (id: string | null) => void;
  setConversations: (convos: Conversation[]) => void;
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  addConversation: (convo: Conversation) => void;
  toggleList: () => void;
  setShowList: (show: boolean) => void;
  reset: () => void;
}

export const useChat = create<ChatState>((set) => ({
  activeConversationId: null,
  conversations: [],
  messages: [],
  showList: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setConversations: (convos) => set({ conversations: convos }),
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  addConversation: (convo) =>
    set((s) => ({ conversations: [convo, ...s.conversations] })),
  toggleList: () => set((s) => ({ showList: !s.showList })),
  setShowList: (show) => set({ showList: show }),
  reset: () =>
    set({
      activeConversationId: null,
      messages: [],
      showList: false,
    }),
}));
