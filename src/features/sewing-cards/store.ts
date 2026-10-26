import { create } from 'zustand'
import type { CardStatus, SewingCard } from '@/features/sewing-cards/api/schema'

export type CardStatusFilter = CardStatus | 'all'
export type CuttingTab = 'ready' | 'cards'

export type CardDialog =
  | { kind: 'none' }
  | { kind: 'edit'; card: SewingCard }
  | { kind: 'cancel'; card: SewingCard }
  | { kind: 'unsubmit'; card: SewingCard }

interface SewingCardsUiState {
  tab: CuttingTab
  status: CardStatusFilter
  search: string
  tailorId: string | null
  page: number
  selected: string[]
  dialog: CardDialog
  setTab: (tab: CuttingTab) => void
  setStatus: (status: CardStatusFilter) => void
  setSearch: (search: string) => void
  setTailorId: (tailorId: string | null) => void
  setPage: (page: number) => void
  toggleSelected: (number: string) => void
  setSelected: (numbers: string[]) => void
  openDialog: (dialog: CardDialog) => void
  closeDialog: () => void
}

export const useSewingCardsUiStore = create<SewingCardsUiState>((set) => ({
  tab: 'ready',
  status: 'taken',
  search: '',
  tailorId: null,
  page: 1,
  selected: [],
  dialog: { kind: 'none' },
  setTab: (tab) => set({ tab }),
  setStatus: (status) => set({ status, selected: [], page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setTailorId: (tailorId) => set({ tailorId, page: 1 }),
  setPage: (page) => set({ page }),
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
