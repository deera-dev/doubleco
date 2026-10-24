import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/shared/lib/result'
import { supabase } from '@/shared/lib/supabase'
import { type AppError, toAppError } from '@/shared/types/errors'

const rejectionBodySchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
})

async function toFunctionError(error: unknown): Promise<AppError> {
  if (error instanceof FunctionsFetchError) {
    return { kind: 'network', message: 'Failed to reach the server' }
  }

  if (error instanceof FunctionsHttpError) {
    const response: Response = error.context
    const body = rejectionBodySchema.safeParse(await response.json().catch(() => null))

    if (response.status === 401) {
      return { kind: 'unauthorized', message: 'You are not authorized to do this' }
    }
    if (body.success) {
      return {
        kind: 'business',
        code: body.data.error,
        message: body.data.error,
        details: body.data.details,
      }
    }
  }

  return toAppError(error)
}

export async function invokeEdgeFunction<Schema extends z.ZodType>(
  functionName: string,
  schema: Schema,
  body?: Record<string, unknown>,
): Promise<Result<z.infer<Schema>, AppError>> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    return err(await toFunctionError(error))
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return err({
      kind: 'validation',
      message: `Response from "${functionName}" did not match the expected contract`,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }

  return ok(parsed.data)
}
