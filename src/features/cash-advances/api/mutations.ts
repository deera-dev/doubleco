import { useMutation } from '@tanstack/react-query'
import { cashAdvanceKeys } from '@/features/cash-advances/api/queries'
import { savedIdSchema } from '@/features/cash-advances/api/schema'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export interface EntryInput {
  tailorId: string
  amount: number
  entryOn: string
  notes: string | null
  confirmed: boolean
  reason: string | null
}

function useLedgerAction<Input extends object>(action: string) {
  return useMutation<{ id: string }, AppError, Input>({
    mutationFn: (input) => callAction('cash-advances', action, savedIdSchema, input),
    // Kasbon feeds the Saturday payroll, so its numbers go stale too.
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: cashAdvanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['payroll'] }),
      ])
    },
  })
}

export const useRecordAdvance = () => useLedgerAction<EntryInput>('record_advance')
export const useRecordRepayment = () => useLedgerAction<EntryInput>('record_repayment')
export const useUpdateEntry = () =>
  useLedgerAction<{
    id: string
    amount: number
    entryOn: string
    notes: string | null
    reason: string | null
  }>('update_entry')
export const useDeleteEntry = () => useLedgerAction<{ id: string; reason: string }>('delete_entry')
