import { createClient } from 'jsr:@supabase/supabase-js@2'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function createAdminClient() {
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(requireEnv('SUPABASE_URL'), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createUserClient(request: Request) {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
