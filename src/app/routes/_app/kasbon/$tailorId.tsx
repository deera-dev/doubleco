import { createFileRoute } from '@tanstack/react-router'
import { TailorLedgerPage } from '@/features/cash-advances/components/TailorLedgerPage'

export const Route = createFileRoute('/_app/kasbon/$tailorId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { tailorId } = Route.useParams()
  return <TailorLedgerPage tailorId={tailorId} />
}
