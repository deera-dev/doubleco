import { describe, expect, it } from 'vitest'
import { toAppError } from '@/shared/types/errors'

describe('toAppError', () => {
  it('passes through an existing AppError untouched', () => {
    const appError = { kind: 'not_found' as const, message: 'missing' }
    expect(toAppError(appError)).toBe(appError)
  })

  it('wraps a native Error', () => {
    expect(toAppError(new Error('boom'))).toEqual({
      kind: 'unknown',
      message: 'boom',
      cause: expect.any(Error),
    })
  })

  it('wraps an arbitrary thrown value', () => {
    expect(toAppError('nope')).toEqual({
      kind: 'unknown',
      message: 'An unexpected error occurred',
      cause: 'nope',
    })
  })
})
