import { z } from 'zod'

/**
 * API Contract Validation.
 *
 * This is the single source of truth for what a "profile" row looks
 * like. It is not just a TypeScript type — it's a runtime check that
 * guards against Supabase returning a shape the UI doesn't expect
 * (a migration that renamed/removed a column, a nullable the UI assumed
 * was required, etc). Update this schema first whenever the `profiles`
 * table changes; the inferred type below follows automatically.
 */
export const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1),
  avatar_url: z.string().url().nullable(),
  created_at: z.string(),
})

export const profileListSchema = z.array(profileSchema)

export type Profile = z.infer<typeof profileSchema>
