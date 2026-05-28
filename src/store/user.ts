import { create } from "zustand";

interface UserState {
  user: {
    id: string;
    name: string;
    email: string;
    role: "founder" | "manager" | "member";
  } | null;
  loading: boolean;
  setUser: (user: UserState["user"]) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUser = create<UserState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  clearUser: () => set({ user: null, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
