import type { z } from 'zod'
import { err, ok, type Result } from '@/shared/lib/result'
import { type AppError, toAppError } from '@/shared/types/errors'

/**
 * API Contract Validation.
 *
 * Never trust an external response's shape just because TypeScript says
 * so at compile time — `fetch`/Supabase/an Edge Function can return
 * anything at runtime. Parse every response through its Zod schema here,
 * once, at the boundary, so the rest of the app can rely on the inferred
 * type without re-checking it.
 */
export async function fetchJson<Schema extends z.ZodType>(
  input: string,
  schema: Schema,
  init?: RequestInit,
): Promise<Result<z.infer<Schema>, AppError>> {
  let response: Response

  try {
    response = await fetch(input, init)
  } catch {
    return err({ kind: 'network', message: 'Failed to reach the server' })
  }

  if (response.status === 401 || response.status === 403) {
    return err({ kind: 'unauthorized', message: 'You are not authorized to do this' })
  }

  if (response.status === 404) {
    return err({ kind: 'not_found', message: 'Resource not found' })
  }

  if (!response.ok) {
    return err({ kind: 'network', message: `Request failed with status ${response.status}` })
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (cause) {
    return err(toAppError(cause))
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return err({
      kind: 'validation',
      message: 'Response did not match the expected API contract',
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }

  return ok(parsed.data)
}
