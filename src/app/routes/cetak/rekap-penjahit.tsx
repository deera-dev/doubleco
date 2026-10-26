import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { saturdayOf } from '@/features/payroll/lib/dates'
import { TailorBookPrint } from '@/features/reports/TailorBookPrint'
import { todayIsoDate } from '@/shared/lib/format'

const isoDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined

export const Route = createFileRoute('/cetak/rekap-penjahit')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { penjahit?: string; dari?: string; sampai?: string } => ({
    penjahit:
      typeof search.penjahit === 'string' && /^[0-9a-f-]{36}$/.test(search.penjahit)
        ? search.penjahit
        : undefined,
    dari: isoDate(search.dari),
    sampai: isoDate(search.sampai),
  }),
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: TailorBookPage,
})

function TailorBookPage() {
  const { penjahit, dari, sampai } = Route.useSearch()
  const today = todayIsoDate()
  return (
    <TailorBookPrint
      tailorId={penjahit ?? null}
      // The whole year so far, like one Excel sheet per tailor.
      from={dari ?? `${today.slice(0, 4)}-01-01`}
      to={sampai ?? saturdayOf(today)}
    />
  )
}
