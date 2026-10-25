import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { employeeListSchema } from '@/features/employees/api/schema'
import type { StatusFilter, TypeFilter } from '@/features/employees/store'
import { callAction } from '@/shared/lib/bff-action'

export const employeeKeys = {
  all: ['employees'] as const,
  list: (filters: { status: StatusFilter; type: TypeFilter; search: string }) =>
    [...employeeKeys.all, 'list', filters] as const,
}

export function useEmployees(filters: { status: StatusFilter; type: TypeFilter; search: string }) {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => callAction('employees', 'list', employeeListSchema, filters),
    placeholderData: keepPreviousData,
  })
}
