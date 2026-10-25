import { describe, expect, it } from 'vitest'
import {
  composeProductCode,
  cutterInitial,
  parseProductCode,
  previewProductCode,
} from '@/features/work-orders/lib/product-code'

describe('product code', () => {
  it('builds W-124 VCS from cutter, product number and fabric code', () => {
    expect(composeProductCode('wanto', ' 124 ', 'vcs')).toBe('W-124 VCS')
    expect(cutterInitial('  ali ')).toBe('A')
  })

  it('stays empty until every part is known, but previews the gaps', () => {
    expect(composeProductCode('WANTO', '124', '')).toBe('')
    expect(previewProductCode('', '124', '')).toBe('?-124 ???')
  })

  it('reads existing codes, including older spacing', () => {
    expect(parseProductCode('W-133 BLS')).toEqual({
      initial: 'W',
      number: '133',
      fabricCode: 'BLS',
    })
    expect(parseProductCode('A 97 BLS')).toEqual({ initial: 'A', number: '97', fabricCode: 'BLS' })
    expect(parseProductCode('GAMIS')).toBeNull()
  })
})
