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

export type PrintedDocument = 'work_order_card' | 'thp' | 'deposit_recap' | 'tailor_book'

const printMarkSchema = z.object({ count: z.number(), lastAt: z.string() })
export type PrintMark = z.infer<typeof printMarkSchema>

const printMarksSchema = z.object({ marks: z.record(z.string(), printMarkSchema) })

/** How often each document was printed; a key missing from the result was never printed. */
export function usePrintMarks(documentType: PrintedDocument, keys: string[]) {
  return useQuery({
    queryKey: ['print-marks', documentType, keys],
    queryFn: () =>
      callAction('master-data', 'print_marks', printMarksSchema, { documentType, keys }),
    enabled: keys.length > 0,
    staleTime: 30_000,
  })
}

export function useRecordDocumentPrint() {
  return useMutation<
    { documentKey: string },
    AppError,
    { documentType: PrintedDocument; documentKey: string }
  >({
    mutationFn: (input) =>
      callAction('master-data', 'record_print', z.object({ documentKey: z.string() }), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['print-marks'] })
    },
  })
}
