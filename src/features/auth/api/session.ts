import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { clearSessionClock, isSessionExpired } from '@/features/auth/lib/session-expiry'
import { queryClient } from '@/shared/lib/query-client'
import { supabase } from '@/shared/lib/supabase'

export const sessionKeys = {
  session: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,
}

const EXPIRY_CHECK_INTERVAL = 60 * 1000

async function endExpiredSession() {
  await supabase.auth.signOut({ scope: 'local' })
  clearSessionClock()
  queryClient.clear()
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  if (isSessionExpired()) {
    await endExpiredSession()
    return null
  }
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
    const timer = window.setInterval(async () => {
      const { data: current } = await supabase.auth.getSession()
      if (current.session && isSessionExpired()) {
        await endExpiredSession()
        window.location.assign('/login')
      }
    }, EXPIRY_CHECK_INTERVAL)
    return () => {
      data.subscription.unsubscribe()
      window.clearInterval(timer)
    }
  }, [])
}
