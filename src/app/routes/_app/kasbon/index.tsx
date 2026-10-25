import { createFileRoute } from '@tanstack/react-router'
import { CashAdvancesPage } from '@/features/cash-advances/components/CashAdvancesPage'

export const Route = createFileRoute('/_app/kasbon/')({
  component: CashAdvancesPage,
})
