import { create } from 'zustand'
import type { CardStatus, SewingCard } from '@/features/sewing-cards/api/schema'

export type CardStatusFilter = CardStatus | 'all'
export type CuttingTab = 'ready' | 'cards'

export type CardDialog =
  | { kind: 'none' }
  | { kind: 'edit'; card: SewingCard }
  | { kind: 'cancel'; card: SewingCard }

interface SewingCardsUiState {
  tab: CuttingTab
  status: CardStatusFilter
  search: string
  selected: string[]
  dialog: CardDialog
  setTab: (tab: CuttingTab) => void
  setStatus: (status: CardStatusFilter) => void
  setSearch: (search: string) => void
  toggleSelected: (number: string) => void
  setSelected: (numbers: string[]) => void
  openDialog: (dialog: CardDialog) => void
  closeDialog: () => void
}

export const useSewingCardsUiStore = create<SewingCardsUiState>((set) => ({
  tab: 'ready',
  status: 'taken',
  search: '',
  selected: [],
  dialog: { kind: 'none' },
  setTab: (tab) => set({ tab }),
  setStatus: (status) => set({ status, selected: [] }),
  setSearch: (search) => set({ search }),
  toggleSelected: (number) =>
    set((state) => ({
      selected: state.selected.includes(number)
        ? state.selected.filter((value) => value !== number)
        : [...state.selected, number],
    })),
  setSelected: (selected) => set({ selected }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: { kind: 'none' } }),
}))
