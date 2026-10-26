import { create } from 'zustand'

export type ScanMode = 'submit' | 'inspect'

interface ScanUiState {
  /** Setor at the front desk, or Periksa at finishing: the same scan opens a different form. */
  mode: ScanMode
  setMode: (mode: ScanMode) => void
}

export const useScanUiStore = create<ScanUiState>((set) => ({
  mode: 'submit',
  setMode: (mode) => set({ mode }),
}))
