import { create } from 'zustand'

export type ScanMode = 'submit' | 'inspect'

interface ScanUiState {
  /** Setor at the front desk, or Periksa at finishing: the same scan opens a different form. */
  mode: ScanMode
  /** A tailor often hands in several cards at once: the next card without a tailor starts with this one. */
  lastTailorId: string | null
  setMode: (mode: ScanMode) => void
  setLastTailorId: (id: string | null) => void
}

export const useScanUiStore = create<ScanUiState>((set) => ({
  mode: 'submit',
  lastTailorId: null,
  setMode: (mode) => set({ mode }),
  setLastTailorId: (lastTailorId) => set({ lastTailorId }),
}))
