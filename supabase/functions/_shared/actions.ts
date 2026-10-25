import type { z } from 'npm:zod@4'
import { json, preflight, readJson, rejection } from './http.ts'

interface PostgresError {
  code?: string
  message: string
  details?: string | null
}

export class Rejection extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(code)
  }
}

function parseDetails(details: string | null | undefined): unknown {
  if (!details) return undefined
  try {
    return JSON.parse(details)
  } catch {
    return details
  }
}

export function fromPostgres(error: PostgresError): Rejection {
  switch (error.code) {
    case 'P0001':
      return new Rejection(error.message, error.message === 'FORBIDDEN' ? 403 : 400, parseDetails(error.details))
    case '23505':
      return new Rejection('DUPLICATE', 409)
    case '23503':
      return new Rejection('IN_USE', 409)
    case '42501':
      return new Rejection('FORBIDDEN', 403)
    default:
      return new Rejection('UNKNOWN', 500)
  }
}

export function unwrap<T>(result: { data: unknown; error: PostgresError | null }): T {
  if (result.error) throw fromPostgres(result.error)
  return result.data as T
}

export interface Action<Schema extends z.ZodType> {
  input: Schema
  run: (input: z.infer<Schema>, request: Request) => Promise<unknown>
}

export function defineAction<Schema extends z.ZodType>(action: Action<Schema>): Action<Schema> {
  return action
}

export function serveActions(actions: Record<string, Action<z.ZodType>>) {
  Deno.serve(async (request) => {
    const preflightResponse = preflight(request)
    if (preflightResponse) return preflightResponse

    const body = (await readJson(request)) as { action?: unknown; input?: unknown } | null
    const action = typeof body?.action === 'string' ? actions[body.action] : undefined
    if (!action) return rejection('UNKNOWN_ACTION')

    const parsed = action.input.safeParse(body?.input ?? {})
    if (!parsed.success) return rejection('INVALID_INPUT', 400, parsed.error.issues)

    try {
      return json(await action.run(parsed.data, request))
    } catch (error) {
      if (error instanceof Rejection) return rejection(error.code, error.status, error.details)
      console.error(error)
      return rejection('UNKNOWN', 500)
    }
  })
}
