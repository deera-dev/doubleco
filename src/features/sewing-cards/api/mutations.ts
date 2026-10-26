import { useMutation } from '@tanstack/react-query'
import { sewingCardKeys } from '@/features/sewing-cards/api/queries'
import { cardNumberSchema, countSchema, issuedSchema } from '@/features/sewing-cards/api/schema'
import { workOrderKeys } from '@/features/work-orders/api/queries'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export interface IssueCardsInput {
  takenOn: string
  cards: { workOrderItemId: string; quantity: number }[]
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
  return useMutation<Output, AppError, Input>({
    mutationFn: run,
    onSuccess: () => {
      void refreshProduction()
    },
  })
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

export interface SubmitCardInput {
  number: string
  tailorId: string | null
  submittedOn: string
  incomplete: boolean
  remainingNotes: string | null
  confirmed: boolean
  reason: string | null
}

export const useSubmitCard = () =>
  useCardAction((input: SubmitCardInput) =>
    callAction('sewing-cards', 'submit', cardNumberSchema, input),
  )

export const useUnsubmitCard = () =>
  useCardAction((input: { number: string; reason: string }) =>
    callAction('sewing-cards', 'unsubmit', cardNumberSchema, input),
  )

export interface InspectCardInput {
  number: string
  ok: number
  repairable: number
  defective: number
  notes: string | null
  inspectedOn: string
}

export const useInspectCard = () =>
  useCardAction((input: InspectCardInput) =>
    callAction('sewing-cards', 'inspect', cardNumberSchema, input),
  )

export const useDeleteInspection = () =>
  useCardAction((input: { number: string; reason: string }) =>
    callAction('sewing-cards', 'delete_inspection', cardNumberSchema, input),
  )

export const useIssueForWorkOrder = () =>
  useCardAction((input: { workOrderId: string; takenOn: string }) =>
    callAction('sewing-cards', 'issue_for_work_order', issuedSchema, input),
  )

export const useRecordBundles = () =>
  useCardAction(
    (input: {
      workOrderId: string
      takenOn: string
      bundles: { size: string; quantity: number }[]
    }) => callAction('sewing-cards', 'record_bundles', issuedSchema, input),
  )
