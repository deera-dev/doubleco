import { create } from 'zustand'

interface ScanUiState {
  /** A tailor often hands in several cards at once: the next card without a tailor starts with this one. */
  lastTailorId: string | null
  setLastTailorId: (id: string | null) => void
}

export const useScanUiStore = create<ScanUiState>((set) => ({
  lastTailorId: null,
  setLastTailorId: (lastTailorId) => set({ lastTailorId }),
}))
