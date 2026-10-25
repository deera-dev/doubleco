import { describe, expect, it } from 'vitest'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'

describe('formatWorkOrderDate', () => {
  it('prints dates the way the paper WO card does', () => {
    expect(formatWorkOrderDate('2026-10-23')).toBe('23-10-2026')
  })
})
