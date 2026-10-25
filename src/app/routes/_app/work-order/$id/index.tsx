import { createFileRoute } from '@tanstack/react-router'
import { WorkOrderDetail } from '@/features/work-orders/components/WorkOrderDetail'

export const Route = createFileRoute('/_app/work-order/$id/')({
  component: WorkOrderDetailPage,
})

function WorkOrderDetailPage() {
  const { id } = Route.useParams()
  return <WorkOrderDetail id={id} />
}
