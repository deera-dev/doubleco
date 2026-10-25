const submittedAtFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Senin 26/10 14.02", the moment a card was handed in. */
export function formatSubmittedAt(iso: string): string {
  const parts = Object.fromEntries(
    submittedAtFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  )
  return `${parts.weekday} ${parts.day}/${parts.month} ${parts.hour}.${parts.minute}`
}
