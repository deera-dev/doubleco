import { z } from 'zod'
import { formatRupiah } from '@/shared/lib/format'
import type { AppError } from '@/shared/types/errors'

const warningSchema = z.looseObject({ code: z.string() })
const confirmationDetailsSchema = z.object({ warnings: z.array(warningSchema) })

export type ServerWarning = z.infer<typeof warningSchema>

export function confirmationWarnings(error: AppError | null): ServerWarning[] | null {
  if (error?.kind !== 'business' || error.code !== 'CONFIRMATION_REQUIRED') return null
  const parsed = confirmationDetailsSchema.safeParse(error.details)
  return parsed.success ? parsed.data.warnings : null
}

function text(warning: ServerWarning, key: string): string {
  const value = warning[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '-'
}

function tailorOf(warning: ServerWarning): string {
  const code = warning.tailor_code
  const name = warning.tailor_name
  if (typeof name !== 'string') return 'Penjahit ini'
  return typeof code === 'string' ? `${name} (kode ${code})` : name
}

export function describeWarning(warning: ServerWarning): string {
  switch (warning.code) {
    case 'SIMILAR_TAILOR_NAME':
      return `Nama mirip dengan penjahit ${text(warning, 'name')} (kode ${text(warning, 'tailor_code')}).`
    case 'ACCOUNT_NUMBER_USED':
      return `Nomor rekening sudah dipakai ${text(warning, 'name')} (kode ${text(warning, 'tailor_code')}).`
    case 'TAILOR_HAS_OPEN_CARD':
      return `${tailorOf(warning)} masih memegang kartu ${text(warning, 'card_number')} yang belum disetor.`
    case 'DUPLICATE_CARD':
      return `${tailorOf(warning)} sudah punya kartu ${text(warning, 'card_number')} (${text(warning, 'quantity')} pcs) untuk ukuran dan warna yang sama.`
    case 'TAILOR_MULTIPLE_CARDS_IN_BATCH':
      return `${tailorOf(warning)} mendapat lebih dari satu kartu sekaligus.`
    case 'DUPLICATE_CASH_ADVANCE':
      return 'Kasbon dengan nominal dan tanggal yang sama sudah dicatat.'
    case 'SIMILAR_WORK_ORDER_ACTIVE':
      return `WO serupa masih aktif: ${text(warning, 'work_order_number')}.`
    case 'ADVANCE_BALANCE_NEGATIVE':
      return `Cicilan melebihi sisa kasbon (${formatRupiah(Number(warning.balance ?? 0))}). Sisa jadi ${formatRupiah(Number(warning.after ?? 0))}.`
    case 'TRANSFER_NEGATIVE':
      return `${tailorOf(warning)}: transfer jadi minus (${formatRupiah(Number(warning.transfer_amount ?? 0))}).`
    case 'MISSING_PAYMENT_ACCOUNT':
      return `${tailorOf(warning)} belum punya rekening. Transfernya perlu dibayar tunai.`
    case 'SUNDAY_IS_HOLIDAY':
      return 'Tanggal yang dipilih hari Minggu (libur).'
    default:
      return 'Ada data serupa yang perlu dicek.'
  }
}
