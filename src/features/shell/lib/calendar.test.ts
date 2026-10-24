import { describe, expect, it } from 'vitest'
import { greetingFor, paydayInfo } from '@/features/shell/lib/calendar'

describe('paydayInfo', () => {
  it('counts down from Monday to Saturday', () => {
    const info = paydayInfo(new Date(2026, 9, 19))
    expect(info.daysUntil).toBe(5)
    expect(info.payday.getDate()).toBe(24)
    expect(info.workdayIndex).toBe(0)
  })

  it('is payday on Saturday itself', () => {
    const info = paydayInfo(new Date(2026, 9, 24))
    expect(info.daysUntil).toBe(0)
    expect(info.workdayIndex).toBe(5)
  })

  it('treats Sunday as a holiday before next week', () => {
    const info = paydayInfo(new Date(2026, 9, 25))
    expect(info.daysUntil).toBe(6)
    expect(info.payday.getDate()).toBe(31)
    expect(info.workdayIndex).toBeNull()
  })
})

describe('greetingFor', () => {
  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 9, 24, 8))).toBe('Selamat pagi')
    expect(greetingFor(new Date(2026, 9, 24, 13))).toBe('Selamat siang')
    expect(greetingFor(new Date(2026, 9, 24, 16))).toBe('Selamat sore')
    expect(greetingFor(new Date(2026, 9, 24, 20))).toBe('Selamat malam')
  })
})
