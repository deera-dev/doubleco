import { describe, expect, it } from 'vitest'
import { findByLabel, labelKey, normalizeLabel, suggestLabels } from '@/shared/lib/labels'

describe('labels', () => {
  it('ignores case, spaces and punctuation when matching', () => {
    expect(labelKey(' Black-Swan ')).toBe(labelKey('BLACK SWAN'))
    expect(findByLabel(['BLACK SWAN', 'ORB'], 'blackswan', (value) => value)).toBe('BLACK SWAN')
    expect(findByLabel(['BLACK SWAN'], '  ', (value) => value)).toBeUndefined()
  })

  it('normalises typed text the way the database stores it', () => {
    expect(normalizeLabel('  w-133   bls ')).toBe('W-133 BLS')
  })

  it('puts prefix matches before other matches', () => {
    expect(suggestLabels(['A 97 BLS', 'W-133 BLS', 'BLS-1'], 'bls')).toEqual([
      'BLS-1',
      'A 97 BLS',
      'W-133 BLS',
    ])
  })
})
