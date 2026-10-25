import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { payrollOverviewSchema, payrollTailorsSchema } from '@/features/payroll/api/schema'
import { callAction } from '@/shared/lib/bff-action'

export const payrollKeys = {
  all: ['payroll'] as const,
  overview: (payOn: string | null) => ['payroll', 'overview', payOn] as const,
  tailors: ['payroll', 'tailors'] as const,
}

export function usePayrollOverview(payOn: string | null) {
  return useQuery({
    queryKey: payrollKeys.overview(payOn),
    queryFn: () => callAction('payroll', 'overview', payrollOverviewSchema, { payOn }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function usePayrollTailors() {
  return useQuery({
    queryKey: payrollKeys.tailors,
    queryFn: () => callAction('payroll', 'tailor_options', payrollTailorsSchema),
    staleTime: 5 * 60 * 1000,
  })
}
