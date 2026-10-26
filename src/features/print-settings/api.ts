import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export const printDocumentSchema = z.enum([
  'sewing_card',
  'work_order_card',
  'thp',
  'transfer_list',
])
export type PrintDocument = z.infer<typeof printDocumentSchema>

const settingsSchema = z.object({
  settings: z.array(
    z.object({ documentType: printDocumentSchema, top: z.number(), left: z.number() }),
  ),
})

const printSettingsKey = ['print-settings'] as const

export function usePrintSettings() {
  return useQuery({
    queryKey: printSettingsKey,
    queryFn: () => callAction('master-data', 'print_settings', settingsSchema),
  })
}

export function useSavePrintSetting() {
  return useMutation<
    { documentType: string },
    AppError,
    { documentType: PrintDocument; top: number; left: number }
  >({
    mutationFn: (input) =>
      callAction(
        'master-data',
        'save_print_setting',
        z.object({ documentType: z.string() }),
        input,
      ),
    // Every print page reads the offsets, so all of them refresh.
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}
