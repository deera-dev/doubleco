import { useQuery } from '@tanstack/react-query'
import { type Profile, profileSchema } from '@/features/profile/api/schema'
import { err, ok, type Result } from '@/shared/lib/result'
import { supabase } from '@/shared/lib/supabase'
import { type AppError, toAppError } from '@/shared/types/errors'

/**
 * Reference pattern — adapt once the PRD defines the real `profiles`
 * table/columns. Not mounted on any route yet.
 *
 * Centralized query keys avoid typo'd cache keys and make invalidation
 * ("refetch every profile query") a single call elsewhere in the app.
 */
export const profileKeys = {
  all: ['profiles'] as const,
  detail: (id: string) => [...profileKeys.all, id] as const,
}

async function fetchProfile(id: string): Promise<Result<Profile, AppError>> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()

  if (error) {
    return err(toAppError(error))
  }

  const parsed = profileSchema.safeParse(data)
  if (!parsed.success) {
    return err({
      kind: 'validation',
      message: 'Profile response did not match the expected API contract',
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }

  return ok(parsed.data)
}

/**
 * TanStack Query owns this data as server state. Components read it via
 * this hook and never reach into Supabase directly — that keeps the
 * fetching/caching/retry logic in one place (SRP) and swappable later.
 */
export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: async () => {
      const result = await fetchProfile(id)
      if (!result.ok) throw result.error
      return result.value
    },
    enabled: Boolean(id),
  })
}
