import { create } from 'zustand';

interface UIState {
  chatPanelOpen: boolean;
  sidebarOpen: boolean;
  toggleChatPanel: () => void;
  toggleSidebar: () => void;
  setChatPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  chatPanelOpen: true,
  sidebarOpen: true,
  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
}));
