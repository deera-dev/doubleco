import { useMutation } from '@tanstack/react-query'
import { workOrderKeys } from '@/features/work-orders/api/queries'
import { countSchema, photoUploadSchema, savedIdSchema } from '@/features/work-orders/api/schema'
import { callAction } from '@/shared/lib/bff-action'
import { prepareImageForUpload } from '@/shared/lib/image'
import { queryClient } from '@/shared/lib/query-client'
import { supabase } from '@/shared/lib/supabase'
import type { AppError } from '@/shared/types/errors'

export interface WorkOrderPayload {
  number: string
  orderedOn: string
  product: string
  category: 'S' | 'M' | 'L' | null
  fabric: string
  series: string
  cutter: string
  pattern: string | null
  combination: string | null
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
    (input: WorkOrderPayload & { sizes: string[]; colors: string[]; confirmed: boolean }) =>
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

const uploadFailed: AppError = {
  kind: 'business',
  code: 'PHOTO_UPLOAD_FAILED',
  message: 'Photo upload failed',
}

export const useUploadWorkOrderPhoto = () =>
  useWorkOrderAction(async ({ id, file }: { id: string; file: File }) => {
    const photo = await prepareImageForUpload(file)
    const target = await callAction('work-orders', 'photo_upload_url', photoUploadSchema, {
      id,
      contentType: 'image/jpeg',
    })
    const { error } = await supabase.storage
      .from(target.bucket)
      .uploadToSignedUrl(target.path, target.token, photo, { contentType: 'image/jpeg' })
    if (error) throw uploadFailed
    return callAction('work-orders', 'set_photo', savedIdSchema, { id, path: target.path })
  })

export const useRemoveWorkOrderPhoto = () =>
  useWorkOrderAction((input: { id: string }) =>
    callAction('work-orders', 'remove_photo', savedIdSchema, input),
  )
