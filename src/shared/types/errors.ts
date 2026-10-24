/**
 * A typed, discriminated application error. Every layer that can fail
 * (network calls, Supabase queries, API contract validation) normalizes
 * into this shape instead of throwing arbitrary `Error`/`unknown` values,
 * so callers can `switch` on `kind` and handle each case deliberately.
 */
export type AppError =
  | { kind: 'network'; message: string }
  | { kind: 'validation'; message: string; issues: string[] }
  | { kind: 'not_found'; message: string }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'unknown'; message: string; cause?: unknown }

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error

  if (error instanceof Error) {
    return { kind: 'unknown', message: error.message, cause: error }
  }

  return { kind: 'unknown', message: 'An unexpected error occurred', cause: error }
}

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value && 'message' in value
}
