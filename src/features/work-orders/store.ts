import { create } from 'zustand'
import type { WorkOrderStatus } from '@/features/work-orders/api/schema'

export type WorkOrderStatusFilter = WorkOrderStatus | 'active' | 'all'

interface WorkOrdersUiState {
  status: WorkOrderStatusFilter
  search: string
  dialog: 'none' | 'add-items' | 'cancel'
  setStatus: (status: WorkOrderStatusFilter) => void
  setSearch: (search: string) => void
  openDialog: (dialog: 'add-items' | 'cancel') => void
  closeDialog: () => void
}

export const useWorkOrdersUiStore = create<WorkOrdersUiState>((set) => ({
  status: 'active',
  search: '',
  dialog: 'none',
  setStatus: (status) => set({ status }),
  setSearch: (search) => set({ search }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: 'none' }),
}))
