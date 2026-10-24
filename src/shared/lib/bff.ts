import type { z } from 'zod'
import { err, ok, type Result } from '@/shared/lib/result'
import { supabase } from '@/shared/lib/supabase'
import { type AppError, toAppError } from '@/shared/types/errors'

export async function invokeEdgeFunction<Schema extends z.ZodType>(
  functionName: string,
  schema: Schema,
  body?: Record<string, unknown>,
): Promise<Result<z.infer<Schema>, AppError>> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    return err(toAppError(error))
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
