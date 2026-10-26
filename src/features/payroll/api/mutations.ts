import { useMutation } from '@tanstack/react-query'
import { payrollKeys } from '@/features/payroll/api/queries'
import type { AdditionKind } from '@/features/payroll/api/schema'
import { savedIdSchema, savedPayOnSchema } from '@/features/payroll/api/schema'
import { sewingCardKeys } from '@/features/sewing-cards/api/queries'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

function usePayrollAction<Input extends object, Output>(run: (input: Input) => Promise<Output>) {
  return useMutation<Output, AppError, Input>({
    mutationFn: run,
    // Locking pays cards and books kasbon repayments, so those screens refresh too.
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
        queryClient.invalidateQueries({ queryKey: sewingCardKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['cash-advances'] }),
      ])
    },
  })
}

export const useSetRepayment = () =>
  usePayrollAction(
    (input: { lineId: string; amount: number; confirmed: boolean; reason: string | null }) =>
      callAction('payroll', 'set_repayment', savedIdSchema, input),
  )

export const useAddAddition = () =>
  usePayrollAction(
    (input: {
      payOn: string
      tailorId: string
      kind: AdditionKind
      amount: number
      notes: string | null
    }) => callAction('payroll', 'add_addition', savedIdSchema, input),
  )

export const useRemoveAddition = () =>
  usePayrollAction((input: { id: string; reason: string | null }) =>
    callAction('payroll', 'remove_addition', savedIdSchema, input),
  )

export const useLockPayroll = () =>
  usePayrollAction((input: { payOn: string; confirmed: boolean; reason: string | null }) =>
    callAction('payroll', 'lock', savedPayOnSchema, input),
  )

export const useUnlockPayroll = () =>
  usePayrollAction((input: { payOn: string; reason: string }) =>
    callAction('payroll', 'unlock', savedPayOnSchema, input),
  )

export const useMarkPaid = () =>
  usePayrollAction((input: { lineId: string }) =>
    callAction('payroll', 'mark_paid', savedIdSchema, input),
  )

export const useDecideDeduction = () =>
  usePayrollAction((input: { id: string; decision: 'deduct' | 'waive'; notes: string | null }) =>
    callAction('payroll', 'decide_deduction', savedIdSchema, input),
  )
