import { useQuery } from '@tanstack/react-query'
import { masterDataSchema } from '@/features/master-data/api/schema'
import { callAction } from '@/shared/lib/bff-action'

export const masterDataKeys = {
  overview: ['master-data', 'overview'] as const,
}

export function useMasterData() {
  return useQuery({
    queryKey: masterDataKeys.overview,
    queryFn: () => callAction('master-data', 'overview', masterDataSchema),
  })
}
