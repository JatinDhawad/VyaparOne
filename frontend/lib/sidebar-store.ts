import { create } from 'zustand';

interface UIState {
  isMobileOpen: boolean;
  isCollapsed: boolean;
  isCommandOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;
}

export const useSidebarStore = create<UIState>((set) => ({
  isMobileOpen: false,
  isCollapsed: false,
  isCommandOpen: false,
  openMobile: () => set({ isMobileOpen: true }),
  closeMobile: () => set({ isMobileOpen: false }),
  toggleMobile: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  openCommand: () => set({ isCommandOpen: true }),
  closeCommand: () => set({ isCommandOpen: false }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
}));

// Export alias for command palette consumers
export const useCommandPaletteStore = useSidebarStore;
