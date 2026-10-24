import { z } from 'zod'

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is required'),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
})

function parseClientEnv() {
  const result = clientEnvSchema.safeParse(import.meta.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Invalid environment configuration. Check your .env file against .env.example:\n${issues}`,
    )
  }

  return result.data
}

export const env = parseClientEnv()
