import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  boardSchema,
  cardListSchema,
  printDataSchema,
  splitOptionsSchema,
} from '@/features/sewing-cards/api/schema'
import type { CardStatusFilter } from '@/features/sewing-cards/store'
import { callAction } from '@/shared/lib/bff-action'

export interface CardListFilters {
  status: CardStatusFilter
  search: string
  workOrderId: string | null
}

export const sewingCardKeys = {
  all: ['sewing-cards'] as const,
  board: ['sewing-cards', 'board'] as const,
  list: (filters: CardListFilters) => ['sewing-cards', 'list', filters] as const,
  split: (workOrderId: string) => ['sewing-cards', 'split', workOrderId] as const,
  print: (numbers: string[]) => ['sewing-cards', 'print', numbers] as const,
}

export function useCuttingBoard() {
  return useQuery({
    queryKey: sewingCardKeys.board,
    queryFn: () => callAction('sewing-cards', 'board', boardSchema),
  })
}

export function useSewingCards(filters: CardListFilters) {
  return useQuery({
    queryKey: sewingCardKeys.list(filters),
    queryFn: () => callAction('sewing-cards', 'list', cardListSchema, filters),
    placeholderData: keepPreviousData,
  })
}

export function useSplitOptions(workOrderId: string) {
  return useQuery({
    queryKey: sewingCardKeys.split(workOrderId),
    queryFn: () => callAction('sewing-cards', 'split_options', splitOptionsSchema, { workOrderId }),
  })
}

export function useCardPrint(numbers: string[]) {
  return useQuery({
    queryKey: sewingCardKeys.print(numbers),
    queryFn: () => callAction('sewing-cards', 'print', printDataSchema, { numbers }),
    enabled: numbers.length > 0,
  })
}
