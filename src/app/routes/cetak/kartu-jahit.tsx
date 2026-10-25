import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { SewingCardPrint } from '@/features/sewing-cards/components/SewingCardPrint'
import { parseCardNumbers } from '@/features/sewing-cards/lib/status'

export const Route = createFileRoute('/cetak/kartu-jahit')({
  validateSearch: (search: Record<string, unknown>): { nomor: string } => ({
    nomor: typeof search.nomor === 'string' ? search.nomor : '',
  }),
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: SewingCardPrintPage,
})

function SewingCardPrintPage() {
  const { nomor } = Route.useSearch()
  return <SewingCardPrint numbers={parseCardNumbers(nomor)} />
}
