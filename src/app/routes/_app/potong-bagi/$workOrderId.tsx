import { createFileRoute } from '@tanstack/react-router'
import { SplitPage } from '@/features/sewing-cards/components/SplitPage'

export const Route = createFileRoute('/_app/potong-bagi/$workOrderId')({
  component: SplitWorkOrderPage,
})

function SplitWorkOrderPage() {
  const { workOrderId } = Route.useParams()
  return <SplitPage workOrderId={workOrderId} />
}
