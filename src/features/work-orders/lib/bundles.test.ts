import { describe, expect, it } from 'vitest'
import { parseBundles } from '@/features/work-orders/lib/bundles'

describe('parseBundles', () => {
  it('reads one or many bundle quantities', () => {
    expect(parseBundles('12')).toEqual([12])
    expect(parseBundles('12 9 11')).toEqual([12, 9, 11])
    expect(parseBundles(' 12, 9,,11 ')).toEqual([12, 9, 11])
  })

  it('ignores empty and zero values', () => {
    expect(parseBundles('')).toEqual([])
    expect(parseBundles('0 5')).toEqual([5])
  })
})
