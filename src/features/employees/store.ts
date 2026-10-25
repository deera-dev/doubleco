import { create } from 'zustand'
import type { Employee, EmployeeStatus } from '@/features/employees/api/schema'

export type StatusFilter = EmployeeStatus | 'all'
export type TypeFilter = Employee['type'] | 'all'

export type EmployeeEditor =
  | { kind: 'closed' }
  | { kind: 'tailor'; employee: Employee | null }
  | { kind: 'cutter'; employee: Employee | null }
  | { kind: 'leave'; employee: Employee }

interface EmployeesUiState {
  status: StatusFilter
  type: TypeFilter
  search: string
  editor: EmployeeEditor
  setStatus: (status: StatusFilter) => void
  setType: (type: TypeFilter) => void
  setSearch: (search: string) => void
  openEditor: (editor: EmployeeEditor) => void
  closeEditor: () => void
}

export const useEmployeesUiStore = create<EmployeesUiState>((set) => ({
  status: 'active',
  type: 'all',
  search: '',
  editor: { kind: 'closed' },
  setStatus: (status) => set({ status }),
  setType: (type) => set({ type }),
  setSearch: (search) => set({ search }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: { kind: 'closed' } }),
}))
