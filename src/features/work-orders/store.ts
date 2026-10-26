import { create } from 'zustand'
import type { WorkOrderStatus } from '@/features/work-orders/api/schema'

export type WorkOrderStatusFilter = WorkOrderStatus | 'active' | 'all'

export interface WorkOrderFilters {
  fabricId: string | null
  cutterId: string | null
  category: 'S' | 'M' | 'L' | null
}

interface WorkOrdersUiState extends WorkOrderFilters {
  status: WorkOrderStatusFilter
  search: string
  page: number
  dialog: 'none' | 'add-items' | 'cancel'
  setStatus: (status: WorkOrderStatusFilter) => void
  setSearch: (search: string) => void
  setFilters: (filters: Partial<WorkOrderFilters>) => void
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
  page: 1,
  dialog: 'none',
  setStatus: (status) => set({ status, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setFilters: (filters) => set({ ...filters, page: 1 }),
  setPage: (page) => set({ page }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: 'none' }),
}))
