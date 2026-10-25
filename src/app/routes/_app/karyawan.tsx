import { createFileRoute } from '@tanstack/react-router'
import { EmployeesPage } from '@/features/employees/components/EmployeesPage'

export const Route = createFileRoute('/_app/karyawan')({
  component: EmployeesPage,
})
