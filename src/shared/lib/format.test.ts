import { describe, expect, it } from 'vitest'
import { formatIsoDate, formatRupiah, maskAccountNumber } from '@/shared/lib/format'

describe('format helpers', () => {
  it('formats rupiah without decimals', () => {
    expect(formatRupiah(1970000).replace(/\s/g, ' ')).toBe('Rp 1.970.000')
  })

  it('formats ISO dates in Indonesian', () => {
    expect(formatIsoDate('2026-10-24')).toBe('24 Okt 2026')
  })

  it('masks all but the last four account digits', () => {
    expect(maskAccountNumber('901069806285')).toBe('•••• 6285')
    expect(maskAccountNumber('0812')).toBe('0812')
  })
})
