import { createFileRoute } from '@tanstack/react-router'
import { WorkOrderForm } from '@/features/work-orders/components/WorkOrderForm'

export const Route = createFileRoute('/_app/work-order/baru')({
  component: () => <WorkOrderForm workOrder={null} />,
})
