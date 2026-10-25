import { createFileRoute } from '@tanstack/react-router'
import { WorkOrdersPage } from '@/features/work-orders/components/WorkOrdersPage'

export const Route = createFileRoute('/_app/work-order/')({
  component: WorkOrdersPage,
})
