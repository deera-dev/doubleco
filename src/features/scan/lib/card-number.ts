const CARD_NUMBER = /^KJ-\d{4}-\d{4,}$/

/**
 * Turns a scanned or typed value into a card number (KJ-YYMM-NNNN).
 * Accepts the QR payload as-is, and typed shortcuts such as "kj 2610 0042", "2610-0042" or "26100042".
 */
export function normalizeCardNumber(raw: string): string | null {
  const value = raw.trim().toUpperCase()
  if (CARD_NUMBER.test(value)) return value
  const digits = value.replace(/^KJ/, '').replace(/[^0-9]/g, '')
  if (digits.length < 8) return null
  const candidate = `KJ-${digits.slice(0, 4)}-${digits.slice(4)}`
  return CARD_NUMBER.test(candidate) ? candidate : null
}
