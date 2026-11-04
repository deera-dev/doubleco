import { describe, expect, it } from 'vitest'
import { nextWorkOrderNumber } from '@/features/work-orders/lib/work-order-number'

const original = { number: 'WO_W-118 VCS', productCode: 'W-118 VCS' }

describe('nextWorkOrderNumber', () => {
  it('fills a new WO with the suggestion', () => {
    expect(
      nextWorkOrderNumber({
        original: null,
        product: 'W-118 VCS',
        suggested: 'WO_W-118 VCS',
        isTypedByHand: false,
      }),
    ).toBe('WO_W-118 VCS')
  })

  it('renames the WO when an edit changes the product', () => {
    expect(
      nextWorkOrderNumber({
        original,
        product: 'W-120 VCS',
        suggested: 'WO_W-120 VCS',
        isTypedByHand: false,
      }),
    ).toBe('WO_W-120 VCS')
  })

  it('restores the original number when the product goes back', () => {
    expect(
      nextWorkOrderNumber({
        original,
        product: 'w-118 vcs',
        suggested: 'WO_W-118 VCS_2',
        isTypedByHand: false,
      }),
    ).toBe('WO_W-118 VCS')
  })

  it('keeps a hand-typed or custom number', () => {
    expect(
      nextWorkOrderNumber({
        original,
        product: 'W-120 VCS',
        suggested: 'WO_W-120 VCS',
        isTypedByHand: true,
      }),
    ).toBeNull()
    expect(
      nextWorkOrderNumber({
        original: { number: 'WO KHUSUS LEBARAN', productCode: 'W-118 VCS' },
        product: 'W-120 VCS',
        suggested: 'WO_W-120 VCS',
        isTypedByHand: false,
      }),
    ).toBeNull()
  })
})
