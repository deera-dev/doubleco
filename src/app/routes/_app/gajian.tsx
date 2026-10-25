import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PayrollPage } from '@/features/payroll/components/PayrollPage'
import { isSaturday } from '@/features/payroll/lib/dates'

const searchSchema = z.object({
  sabtu: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => (value && isSaturday(value) ? value : undefined)),
})

export const Route = createFileRoute('/_app/gajian')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { sabtu } = Route.useSearch()
  return <PayrollPage payOn={sabtu ?? null} />
}
