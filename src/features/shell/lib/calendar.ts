import { addDays, format, getHours, getISODay } from 'date-fns'
import { id } from 'date-fns/locale'

const SATURDAY = 6

export interface PaydayInfo {
  payday: Date
  daysUntil: number
  workdayIndex: number | null
}

export function paydayInfo(today: Date): PaydayInfo {
  const isoDay = getISODay(today)
  const daysUntil = (SATURDAY - isoDay + 7) % 7
  return {
    payday: addDays(today, daysUntil),
    daysUntil,
    workdayIndex: isoDay <= SATURDAY ? isoDay - 1 : null,
  }
}

export function greetingFor(now: Date): string {
  const hour = getHours(now)
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function formatLongDate(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy', { locale: id })
}

export function formatShortDate(date: Date): string {
  return format(date, 'EEE, d MMM', { locale: id })
}

export const workdays = [
  { key: 'senin', initial: 'S' },
  { key: 'selasa', initial: 'S' },
  { key: 'rabu', initial: 'R' },
  { key: 'kamis', initial: 'K' },
  { key: 'jumat', initial: 'J' },
  { key: 'sabtu', initial: 'S' },
] as const
