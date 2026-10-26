import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { callAction } from '@/shared/lib/bff-action'

const thpSchema = z.object({
  workOrder: z.object({
    number: z.string(),
    productCode: z.string(),
    orderedOn: z.string(),
    cutterName: z.string(),
    fabricName: z.string(),
    fabricCombination: z.string().nullable(),
  }),
  sizes: z.array(
    z.object({
      name: z.string(),
      rows: z.array(
        z.object({
          cardNumber: z.string(),
          tailorName: z.string().nullable(),
          tailorCode: z.string().nullable(),
          quantity: z.number(),
          takenOn: z.string(),
          submittedOn: z.string().nullable(),
          receivedQuantity: z.number().nullable(),
          okQuantity: z.number().nullable(),
          defectiveQuantity: z.number().nullable(),
          notes: z.string().nullable(),
        }),
      ),
    }),
  ),
})

export type ThpData = z.infer<typeof thpSchema>
export type ThpRow = ThpData['sizes'][number]['rows'][number]

const tailorHistorySchema = z.object({
  from: z.string(),
  to: z.string(),
  tailors: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      account: z
        .object({ provider: z.string(), number: z.string(), holder: z.string() })
        .nullable(),
      openingBalance: z.number(),
      weeks: z.array(
        z.object({
          payOn: z.string(),
          advance: z.number(),
          wage: z.number(),
          repayment: z.number(),
          writeOff: z.number(),
          transfer: z.number().nullable(),
          balance: z.number(),
        }),
      ),
    }),
  ),
})

export type TailorHistory = z.infer<typeof tailorHistorySchema>
export type TailorBook = TailorHistory['tailors'][number]

export function useThp(workOrderId: string) {
  return useQuery({
    queryKey: ['reports', 'thp', workOrderId],
    queryFn: () => callAction('work-orders', 'thp', thpSchema, { id: workOrderId }),
    staleTime: 0,
  })
}

export function useTailorHistory(input: { tailorId: string | null; from: string; to: string }) {
  return useQuery({
    queryKey: ['reports', 'tailor-history', input],
    queryFn: () => callAction('payroll', 'tailor_history', tailorHistorySchema, input),
    staleTime: 0,
  })
}
