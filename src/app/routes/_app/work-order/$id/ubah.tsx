import { createFileRoute } from '@tanstack/react-router'
import { useWorkOrder } from '@/features/work-orders/api/queries'
import { WorkOrderForm } from '@/features/work-orders/components/WorkOrderForm'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

export const Route = createFileRoute('/_app/work-order/$id/ubah')({
  component: EditWorkOrderPage,
})

function EditWorkOrderPage() {
  const { id } = Route.useParams()
  const workOrder = useWorkOrder(id)

  if (workOrder.isPending) return <ListSkeleton rows={4} />
  if (workOrder.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {describeError(toAppError(workOrder.error))}
      </p>
    )
  }
  return <WorkOrderForm workOrder={workOrder.data} />
}
