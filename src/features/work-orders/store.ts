import { create } from 'zustand'
import type { WorkOrderStatus } from '@/features/work-orders/api/schema'

export type WorkOrderStatusFilter = WorkOrderStatus | 'active' | 'all'

export type WorkOrderSort =
  | 'number_desc'
  | 'number_asc'
  | 'ordered_desc'
  | 'ordered_asc'
  | 'created_desc'

export const workOrderSortOptions: { value: WorkOrderSort; label: string }[] = [
  { value: 'number_desc', label: 'Nomor terbesar' },
  { value: 'number_asc', label: 'Nomor terkecil' },
  { value: 'ordered_desc', label: 'Tanggal WO terbaru' },
  { value: 'ordered_asc', label: 'Tanggal WO terlama' },
  { value: 'created_desc', label: 'Terakhir dibuat' },
]

const sortKey = 'doubleco.work-orders.sort'

/** The chosen order is a personal preference: it stays on this device. */
function savedSort(): WorkOrderSort {
  try {
    const value = localStorage.getItem(sortKey)
    return workOrderSortOptions.find((option) => option.value === value)?.value ?? 'number_desc'
  } catch {
    return 'number_desc'
  }
}

export interface WorkOrderFilters {
  fabricId: string | null
  cutterId: string | null
  category: 'S' | 'M' | 'L' | null
}

interface WorkOrdersUiState extends WorkOrderFilters {
  status: WorkOrderStatusFilter
  search: string
  sort: WorkOrderSort
  page: number
  dialog: 'none' | 'add-items' | 'cancel'
  setStatus: (status: WorkOrderStatusFilter) => void
  setSearch: (search: string) => void
  setFilters: (filters: Partial<WorkOrderFilters>) => void
  setSort: (sort: WorkOrderSort) => void
  setPage: (page: number) => void
  openDialog: (dialog: 'add-items' | 'cancel') => void
  closeDialog: () => void
}

// Any change to what is listed starts again from page 1.
export const useWorkOrdersUiStore = create<WorkOrdersUiState>((set) => ({
  status: 'active',
  search: '',
  fabricId: null,
  cutterId: null,
  category: null,
  sort: savedSort(),
  page: 1,
  dialog: 'none',
  setStatus: (status) => set({ status, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setFilters: (filters) => set({ ...filters, page: 1 }),
  setSort: (sort) => {
    try {
      localStorage.setItem(sortKey, sort)
    } catch {
      // Not remembered; it still applies now.
    }
    set({ sort, page: 1 })
  },
  setPage: (page) => set({ page }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: 'none' }),
}))
