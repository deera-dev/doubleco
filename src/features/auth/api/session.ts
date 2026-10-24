import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClient } from '@/shared/lib/query-client'
import { supabase } from '@/shared/lib/supabase'

export const sessionKeys = {
  session: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function useSession() {
  return useQuery({
    queryKey: sessionKeys.session,
    queryFn: getCurrentSession,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useAuthStateSync() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(sessionKeys.session, session)
      if (!session) {
        queryClient.removeQueries({ queryKey: sessionKeys.me })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
}
