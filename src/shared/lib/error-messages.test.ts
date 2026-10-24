import { describe, expect, it } from 'vitest'
import { describeError } from '@/shared/lib/error-messages'

describe('describeError', () => {
  it('maps known business codes to Indonesian messages', () => {
    expect(describeError({ kind: 'business', code: 'ACTIVATION_CODE_WRONG', message: 'x' })).toBe(
      'Kode aktivasi salah. Periksa lagi kodenya.',
    )
  })

  it('falls back to a generic message for unknown business codes', () => {
    expect(describeError({ kind: 'business', code: 'SOMETHING_NEW', message: 'x' })).toBe(
      'Permintaan ditolak oleh server.',
    )
  })

  it('explains network failures', () => {
    expect(describeError({ kind: 'network', message: 'x' })).toContain('koneksi internet')
  })
})
