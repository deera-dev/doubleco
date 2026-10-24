import { create } from 'zustand'

/**
 * Global, cross-feature UI state only (things like "is the sidebar open"
 * or "which theme is active"). This is NOT where server data lives —
 * see the "Purity of Store" rule in the README. If a value can be
 * derived from a TanStack Query cache, it does not belong here.
 */
interface UiState {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}))
