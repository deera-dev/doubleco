import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { WorkOrderPrint } from '@/features/work-orders/components/WorkOrderPrint'

export const Route = createFileRoute('/cetak/wo/$id')({
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: WorkOrderPrintPage,
})

function WorkOrderPrintPage() {
  const { id } = Route.useParams()
  return <WorkOrderPrint id={id} />
}
