import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  boardSchema,
  cardListSchema,
  printDataSchema,
  scannedCardSchema,
  scanOptionsSchema,
  splitOptionsSchema,
} from '@/features/sewing-cards/api/schema'
import type { CardStatusFilter } from '@/features/sewing-cards/store'
import { callAction } from '@/shared/lib/bff-action'

export interface CardListFilters {
  status: CardStatusFilter
  search: string
  workOrderId: string | null
  submittedOn?: string | null
}

export const sewingCardKeys = {
  all: ['sewing-cards'] as const,
  board: ['sewing-cards', 'board'] as const,
  list: (filters: CardListFilters) => ['sewing-cards', 'list', filters] as const,
  split: (workOrderId: string) => ['sewing-cards', 'split', workOrderId] as const,
  print: (numbers: string[]) => ['sewing-cards', 'print', numbers] as const,
  scanOptions: ['sewing-cards', 'scan-options'] as const,
  scanned: (number: string) => ['sewing-cards', 'scanned', number] as const,
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

export function useScanOptions() {
  return useQuery({
    queryKey: sewingCardKeys.scanOptions,
    queryFn: () => callAction('sewing-cards', 'scan_options', scanOptionsSchema),
    staleTime: 5 * 60 * 1000,
  })
}

export function useScannedCard(number: string | null) {
  return useQuery({
    queryKey: sewingCardKeys.scanned(number ?? ''),
    queryFn: () => callAction('sewing-cards', 'lookup', scannedCardSchema, { number }),
    enabled: number !== null,
    staleTime: 0,
    retry: false,
  })
}
