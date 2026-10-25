import { useQuery } from '@tanstack/react-query'
import { ledgerSchema, overviewSchema } from '@/features/cash-advances/api/schema'
import { callAction } from '@/shared/lib/bff-action'

export const cashAdvanceKeys = {
  all: ['cash-advances'] as const,
  overview: ['cash-advances', 'overview'] as const,
  ledger: (tailorId: string) => ['cash-advances', 'ledger', tailorId] as const,
}

export function useCashAdvanceOverview() {
  return useQuery({
    queryKey: cashAdvanceKeys.overview,
    queryFn: () => callAction('cash-advances', 'overview', overviewSchema),
  })
}

export function useTailorLedger(tailorId: string) {
  return useQuery({
    queryKey: cashAdvanceKeys.ledger(tailorId),
    queryFn: () => callAction('cash-advances', 'ledger', ledgerSchema, { tailorId }),
  })
}
