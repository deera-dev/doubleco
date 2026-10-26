import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { isSaturday, saturdayOf } from '@/features/payroll/lib/dates'
import { DepositRecapPrint } from '@/features/reports/DepositRecapPrint'
import { todayIsoDate } from '@/shared/lib/format'

export const Route = createFileRoute('/cetak/rekap-setoran')({
  validateSearch: (search: Record<string, unknown>): { sabtu?: string } => ({
    sabtu: typeof search.sabtu === 'string' && isSaturday(search.sabtu) ? search.sabtu : undefined,
  }),
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: DepositRecapPage,
})

function DepositRecapPage() {
  const { sabtu } = Route.useSearch()
  return <DepositRecapPrint payOn={sabtu ?? saturdayOf(todayIsoDate())} />
}
