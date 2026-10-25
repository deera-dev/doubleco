import { useMutation } from '@tanstack/react-query'
import { sewingCardKeys } from '@/features/sewing-cards/api/queries'
import { cardNumberSchema, countSchema, issuedSchema } from '@/features/sewing-cards/api/schema'
import { workOrderKeys } from '@/features/work-orders/api/queries'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export interface IssueCardsInput {
  takenOn: string
  cards: { workOrderItemId: string; tailorId: string; quantity: number }[]
  confirmed: boolean
  reason: string | null
}

function refreshProduction() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sewingCardKeys.all }),
    queryClient.invalidateQueries({ queryKey: workOrderKeys.all }),
  ])
}

function useCardAction<Input extends object, Output>(run: (input: Input) => Promise<Output>) {
  return useMutation<Output, AppError, Input>({ mutationFn: run, onSuccess: refreshProduction })
}

export const useIssueCards = () =>
  useCardAction((input: IssueCardsInput) =>
    callAction('sewing-cards', 'issue', issuedSchema, input),
  )

export const useUpdateCard = () =>
  useCardAction(
    (input: { number: string; quantity: number | null; tailorId: string | null; reason: string }) =>
      callAction('sewing-cards', 'update', cardNumberSchema, input),
  )

export const useCancelCard = () =>
  useCardAction((input: { number: string; reason: string }) =>
    callAction('sewing-cards', 'cancel', cardNumberSchema, input),
  )

export const useRecordPrint = () =>
  useCardAction((input: { numbers: string[] }) =>
    callAction('sewing-cards', 'record_print', countSchema, input),
  )
