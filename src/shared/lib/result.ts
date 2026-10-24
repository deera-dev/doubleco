import type { AppError } from '@/shared/types/errors'

/**
 * A `Result` makes failure part of a function's type signature instead of
 * a hidden `throw`. Prefer this at API/boundary layers (Supabase calls,
 * contract validation) over try/catch sprinkled through feature code.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
