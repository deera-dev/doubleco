import { describe, expect, it } from 'vitest'
import { formatWeek, isSaturday, shiftWeeks } from '@/features/payroll/lib/dates'

describe('payroll dates', () => {
  it('moves whole weeks across month ends', () => {
    expect(shiftWeeks('2026-10-31', 1)).toBe('2026-11-07')
    expect(shiftWeeks('2026-10-31', -1)).toBe('2026-10-24')
  })

  it('accepts only Saturdays', () => {
    expect(isSaturday('2026-10-31')).toBe(true)
    expect(isSaturday('2026-10-30')).toBe(false)
    expect(isSaturday('31-10-2026')).toBe(false)
  })

  it('formats the Monday–Saturday week', () => {
    expect(formatWeek('2026-10-26', '2026-10-31')).toMatch(/26 Okt.*31 Okt/)
  })
})
