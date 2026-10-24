import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fetchJson } from '@/shared/lib/http'

const userSchema = z.object({ id: z.number(), name: z.string() })

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ok with parsed data when the response matches the schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, name: 'Ada' }),
      }),
    )

    const result = await fetchJson('/users/1', userSchema)

    expect(result).toEqual({ ok: true, value: { id: 1, name: 'Ada' } })
  })

  it('returns a validation error when the response violates the contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'not-a-number' }),
      }),
    )

    const result = await fetchJson('/users/1', userSchema)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('validation')
    }
  })

  it('returns a network error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await fetchJson('/users/1', userSchema)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'network', message: 'Failed to reach the server' },
    })
  })

  it('returns a not_found error on a 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const result = await fetchJson('/users/1', userSchema)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found')
    }
  })
})
