import { useMutation } from '@tanstack/react-query'
import { masterDataKeys } from '@/features/master-data/api/queries'
import { savedIdSchema, type WageCategory } from '@/features/master-data/api/schema'
import { callAction } from '@/shared/lib/bff-action'
import { queryClient } from '@/shared/lib/query-client'
import type { AppError } from '@/shared/types/errors'

export type RemovableKind = 'product' | 'fabric' | 'color' | 'size' | 'wage_rate'

function useMasterDataAction<Input extends object>(action: string) {
  return useMutation<{ id: string }, AppError, Input>({
    mutationFn: (input) => callAction('master-data', action, savedIdSchema, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: masterDataKeys.overview }),
  })
}

export const useSaveProduct = () =>
  useMasterDataAction<{
    id: string | null
    code: string
    name: string | null
    category: WageCategory | null
    isActive: boolean
  }>('save_product')

export const useSaveFabric = () =>
  useMasterDataAction<{ id: string | null; name: string; isActive: boolean }>('save_fabric')

export const useSaveColor = () =>
  useMasterDataAction<{ id: string | null; fabricId: string; name: string; isActive: boolean }>(
    'save_color',
  )

export const useSaveSize = () =>
  useMasterDataAction<{ id: string | null; name: string; sortOrder: number; isActive: boolean }>(
    'save_size',
  )

export const useAddWageRate = () =>
  useMasterDataAction<{ category: WageCategory; amount: number; effectiveFrom: string }>(
    'add_wage_rate',
  )

export const useRemoveMasterData = () =>
  useMasterDataAction<{ kind: RemovableKind; id: string }>('remove')
