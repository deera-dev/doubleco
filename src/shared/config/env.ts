import { z } from 'zod'

/**
 * Single source of truth for environment configuration.
 *
 * Vite only exposes `import.meta.env.*` as untyped strings at runtime.
 * Parsing it once, here, through Zod gives the rest of the app a typed,
 * validated `env` object and makes a missing/misconfigured variable fail
 * fast at startup instead of surfacing as a confusing error deep in a
 * feature later.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
})

function parseEnv() {
  const result = envSchema.safeParse(import.meta.env)

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

export const env = parseEnv()
