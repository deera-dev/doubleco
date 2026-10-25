import { useMutation } from '@tanstack/react-query'
import { workOrderKeys } from '@/features/work-orders/api/queries'
import { countSchema, savedIdSchema } from '@/features/work-orders/api/schema'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export interface WorkOrderPayload {
  number: string
  orderedOn: string
  productId: string
  fabricId: string
  cutterId: string
  patternCode: string | null
  fabricCombination: string | null
  changeStatus: 'changed' | 'follow_sample'
  changeNotes: string | null
  additionalInfo: string | null
}

function useWorkOrderAction<Input extends object, Output>(run: (input: Input) => Promise<Output>) {
  return useMutation<Output, AppError, Input>({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workOrderKeys.all }),
  })
}

export const useCreateWorkOrder = () =>
  useWorkOrderAction(
    (input: WorkOrderPayload & { sizeIds: string[]; colorIds: string[]; confirmed: boolean }) =>
      callAction('work-orders', 'create', savedIdSchema, input),
  )

export const useUpdateWorkOrder = () =>
  useWorkOrderAction((input: WorkOrderPayload & { id: string }) =>
    callAction('work-orders', 'update', savedIdSchema, input),
  )

export const useAddWorkOrderItems = () =>
  useWorkOrderAction((input: { id: string; sizeIds: string[]; colorIds: string[] }) =>
    callAction('work-orders', 'add_items', savedIdSchema, input),
  )

export const useRemoveWorkOrderItem = () =>
  useWorkOrderAction((input: { itemId: string }) =>
    callAction('work-orders', 'remove_item', savedIdSchema, input),
  )

export const useRecordCut = () =>
  useWorkOrderAction((input: { items: { workOrderItemId: string; cutQuantity: number }[] }) =>
    callAction('work-orders', 'record_cut', countSchema, input),
  )

export const useCancelWorkOrder = () =>
  useWorkOrderAction((input: { id: string; reason: string }) =>
    callAction('work-orders', 'cancel', savedIdSchema, input),
  )

export const useDeleteWorkOrder = () =>
  useWorkOrderAction((input: { id: string; reason: string }) =>
    callAction('work-orders', 'delete', savedIdSchema, input),
  )
