const longDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`)
}

export function shiftWeeks(isoDate: string, weeks: number): string {
  const date = toDate(isoDate)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

export function isSaturday(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && toDate(isoDate).getUTCDay() === 6
}

/** "Sabtu, 31 Oktober 2026" */
export function formatPayDay(isoDate: string): string {
  return longDate.format(toDate(isoDate))
}

/** "26 Okt – 31 Okt" */
export function formatWeek(startsOn: string, payOn: string): string {
  return `${shortDate.format(toDate(startsOn))} – ${shortDate.format(toDate(payOn))}`
}

/** The Saturday that closes the Monday–Saturday week of a date (the date itself on a Saturday). */
export function saturdayOf(isoDate: string): string {
  const date = toDate(isoDate)
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7))
  return date.toISOString().slice(0, 10)
}
