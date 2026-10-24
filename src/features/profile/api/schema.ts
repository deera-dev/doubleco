import { z } from 'zod'

export const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1),
  avatar_url: z.string().url().nullable(),
  created_at: z.string(),
})

export const profileListSchema = z.array(profileSchema)

export type Profile = z.infer<typeof profileSchema>
