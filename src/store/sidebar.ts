import { create } from "zustand";

interface SidebarState {
  expanded: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  setExpanded: (expanded: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebar = create<SidebarState>((set) => ({
  expanded: true,
  mobileOpen: false,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
  setExpanded: (expanded) => set({ expanded }),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
}));
