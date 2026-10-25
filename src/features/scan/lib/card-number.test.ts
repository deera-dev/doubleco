import { describe, expect, it } from 'vitest'
import { normalizeCardNumber } from '@/features/scan/lib/card-number'

describe('normalizeCardNumber', () => {
  it('keeps a scanned card number', () => {
    expect(normalizeCardNumber('KJ-2610-0042')).toBe('KJ-2610-0042')
  })

  it('accepts typed shortcuts', () => {
    expect(normalizeCardNumber(' kj 2610 0042 ')).toBe('KJ-2610-0042')
    expect(normalizeCardNumber('2610-0042')).toBe('KJ-2610-0042')
    expect(normalizeCardNumber('26100042')).toBe('KJ-2610-0042')
    expect(normalizeCardNumber('2610-12345')).toBe('KJ-2610-12345')
  })

  it('rejects anything that is not a card number', () => {
    expect(normalizeCardNumber('')).toBeNull()
    expect(normalizeCardNumber('42')).toBeNull()
    expect(normalizeCardNumber('DC-WO:abc')).toBeNull()
    expect(normalizeCardNumber('https://example.com')).toBeNull()
  })
})
