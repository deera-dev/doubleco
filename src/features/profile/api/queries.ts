import { useQuery } from '@tanstack/react-query'
import { profileSchema } from '@/features/profile/api/schema'
import { invokeEdgeFunction } from '@/shared/lib/bff'

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (id: string) => [...profileKeys.all, id] as const,
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: async () => {
      const result = await invokeEdgeFunction('get-profile', profileSchema, { id })
      if (!result.ok) throw result.error
      return result.value
    },
    enabled: Boolean(id),
  })
}
