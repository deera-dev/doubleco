import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/config/env'

/**
 * The single Supabase client instance for the app. Import this everywhere
 * instead of calling `createClient` again — one client keeps one auth
 * session, one realtime connection and one connection pool.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
