const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount)
}

export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dateFormatter.format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

export function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `•••• ${accountNumber.slice(-4)}`
}

export function todayIsoDate(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
