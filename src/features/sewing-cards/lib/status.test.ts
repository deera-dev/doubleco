import { describe, expect, it } from 'vitest'
import { cardPrintSearch, parseCardNumbers } from '@/features/sewing-cards/lib/status'

describe('card numbers in the print link', () => {
  it('round-trips through the search param', () => {
    const numbers = ['KJ-2610-0001', 'KJ-2610-0002']
    expect(parseCardNumbers(cardPrintSearch(numbers).nomor)).toEqual(numbers)
  })

  it('drops junk, duplicates and normalises case', () => {
    expect(parseCardNumbers(' kj-2610-0003 ,KJ-2610-0003,hello,')).toEqual(['KJ-2610-0003'])
    expect(parseCardNumbers(undefined)).toEqual([])
  })
})
