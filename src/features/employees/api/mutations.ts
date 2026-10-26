import { useMutation } from '@tanstack/react-query'
import { employeeKeys } from '@/features/employees/api/queries'
import { retentionResultSchema, savedIdSchema } from '@/features/employees/api/schema'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export interface SaveTailorInput {
  id: string | null
  code: string
  name: string
  phone: string | null
  notes: string | null
  account: { type: 'bank' | 'ewallet'; provider: string; number: string; holder: string } | null
  confirmed: boolean
}

// Fire and forget: the button finishes when the save does, the list catches up behind it.
function invalidateEmployees() {
  void queryClient.invalidateQueries({ queryKey: employeeKeys.all })
}

function useEmployeeAction<Input extends object, Output>(run: (input: Input) => Promise<Output>) {
  return useMutation<Output, AppError, Input>({
    mutationFn: run,
    onSuccess: invalidateEmployees,
  })
}

export function useSaveTailor() {
  return useEmployeeAction((input: SaveTailorInput) =>
    callAction('employees', 'save_tailor', savedIdSchema, input),
  )
}

export function useSetTailorStatus() {
  return useEmployeeAction((input: { id: string; status: 'active' | 'inactive' }) =>
    callAction('employees', 'set_tailor_status', savedIdSchema, input),
  )
}

export function useSetRetentionDays() {
  return useEmployeeAction((input: { days: number }) =>
    callAction('employees', 'set_retention_days', retentionResultSchema, input),
  )
}

export function useDeleteTailor() {
  return useEmployeeAction((input: { id: string }) =>
    callAction('employees', 'delete_tailor', savedIdSchema, input),
  )
}

export function useSaveCutter() {
  return useEmployeeAction((input: { id: string | null; name: string; isActive: boolean }) =>
    callAction('employees', 'save_cutter', savedIdSchema, input),
  )
}

export function useDeleteCutter() {
  return useEmployeeAction((input: { id: string }) =>
    callAction('employees', 'delete_cutter', savedIdSchema, input),
  )
}
