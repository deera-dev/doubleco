import type { z } from 'zod'
import { invokeEdgeFunction } from '@/shared/lib/bff'

export async function callAction<Schema extends z.ZodType>(
  functionName: string,
  action: string,
  schema: Schema,
  input: object = {},
): Promise<z.infer<Schema>> {
  const result = await invokeEdgeFunction(functionName, schema, { action, input })
  if (!result.ok) throw result.error
  return result.value
}
