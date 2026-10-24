import { json, preflight, rejection } from '../_shared/http.ts'
import { createUserClient } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  const preflightResponse = preflight(request)
  if (preflightResponse) return preflightResponse

  const supabase = createUserClient(request)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return rejection('UNAUTHORIZED', 401)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, is_active')
    .eq('id', userData.user.id)
    .single()

  if (error || !profile) return rejection('PROFILE_NOT_FOUND', 404)

  return json({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    hasAccess: profile.is_active && profile.role !== null,
  })
})
