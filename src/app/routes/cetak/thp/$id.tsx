import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { ThpPrint } from '@/features/reports/ThpPrint'

export const Route = createFileRoute('/cetak/thp/$id')({
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: ThpPrintPage,
})

function ThpPrintPage() {
  const { id } = Route.useParams()
  return <ThpPrint workOrderId={id} />
}
