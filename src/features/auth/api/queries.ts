import { useQuery } from '@tanstack/react-query'
import { meSchema } from '@/features/auth/api/schema'
import { sessionKeys } from '@/features/auth/api/session'
import { invokeEdgeFunction } from '@/shared/lib/bff'

export function useMe() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: async () => {
      const result = await invokeEdgeFunction('get-me', meSchema)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
