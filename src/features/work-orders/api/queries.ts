import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  formOptionsSchema,
  printDataSchema,
  suggestionSchema,
  workOrderListSchema,
  workOrderSchema,
} from '@/features/work-orders/api/schema'
import type { WorkOrderStatusFilter } from '@/features/work-orders/store'
import { callAction } from '@/shared/lib/bff-action'

export const workOrderKeys = {
  all: ['work-orders'] as const,
  list: (filters: WorkOrderListFilters) => [...workOrderKeys.all, 'list', filters] as const,
  detail: (id: string) => [...workOrderKeys.all, 'detail', id] as const,
  options: ['work-orders', 'form-options'] as const,
  suggestion: (product: string) => ['work-orders', 'suggestion', product] as const,
  print: (id: string) => [...workOrderKeys.all, 'print', id] as const,
}

export interface WorkOrderListFilters {
  status: WorkOrderStatusFilter
  search: string
  fabricId: string | null
  cutterId: string | null
  category: 'S' | 'M' | 'L' | null
  page: number
}

export function fetchWorkOrders(filters: WorkOrderListFilters & { pageSize?: number }) {
  return callAction('work-orders', 'list', workOrderListSchema, filters)
}

export function useWorkOrders(filters: WorkOrderListFilters) {
  return useQuery({
    queryKey: workOrderKeys.list(filters),
    queryFn: () => fetchWorkOrders(filters),
    placeholderData: keepPreviousData,
  })
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: workOrderKeys.detail(id),
    queryFn: () => callAction('work-orders', 'get', workOrderSchema, { id }),
  })
}

export function useWorkOrderFormOptions() {
  return useQuery({
    queryKey: workOrderKeys.options,
    queryFn: () => callAction('work-orders', 'form_options', formOptionsSchema),
  })
}

export function useNumberSuggestion(product: string, enabled: boolean) {
  return useQuery({
    queryKey: workOrderKeys.suggestion(product),
    queryFn: () => callAction('work-orders', 'suggest_number', suggestionSchema, { product }),
    enabled: enabled && product.trim() !== '',
    staleTime: 0,
  })
}

export function useWorkOrderPrint(id: string) {
  return useQuery({
    queryKey: workOrderKeys.print(id),
    queryFn: () => callAction('work-orders', 'print', printDataSchema, { id }),
  })
}
