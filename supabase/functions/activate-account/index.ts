import { z } from 'npm:zod@4'
import { json, preflight, readJson, rejection } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const activationRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/),
  code: z.string().trim().toUpperCase().length(8),
  password: z.string().min(8).max(72),
})

Deno.serve(async (request) => {
  const preflightResponse = preflight(request)
  if (preflightResponse) return preflightResponse

  const parsed = activationRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) return rejection('INVALID_INPUT')

  const { username, code, password } = parsed.data
  const admin = createAdminClient()

  const { data: profileId, error } = await admin.rpc('consume_activation_code', {
    p_username: username,
    p_code: code,
  })

  if (error) {
    return error.message === 'ACTIVATION_INVALID'
      ? rejection('ACTIVATION_INVALID')
      : rejection('UNKNOWN', 500)
  }
  if (!profileId) return rejection('ACTIVATION_CODE_WRONG')

  const { error: updateError } = await admin.auth.admin.updateUserById(profileId, { password })
  if (updateError) return rejection('PASSWORD_UPDATE_FAILED', 500)

  return json({ activated: true })
})
