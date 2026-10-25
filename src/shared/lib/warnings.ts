import { z } from 'zod'
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

export function describeWarning(warning: ServerWarning): string {
  switch (warning.code) {
    case 'SIMILAR_TAILOR_NAME':
      return `Nama mirip dengan penjahit ${text(warning, 'name')} (kode ${text(warning, 'tailor_code')}).`
    case 'ACCOUNT_NUMBER_USED':
      return `Nomor rekening sudah dipakai ${text(warning, 'name')} (kode ${text(warning, 'tailor_code')}).`
    case 'TAILOR_HAS_OPEN_CARD':
      return `Masih memegang kartu ${text(warning, 'card_number')} yang belum selesai.`
    case 'DUPLICATE_CASH_ADVANCE':
      return 'Kasbon dengan nominal dan tanggal yang sama sudah dicatat.'
    case 'SIMILAR_WORK_ORDER_ACTIVE':
      return `WO serupa masih aktif: ${text(warning, 'work_order_number')}.`
    case 'SUNDAY_IS_HOLIDAY':
      return 'Tanggal yang dipilih hari Minggu (libur).'
    default:
      return 'Ada data serupa yang perlu dicek.'
  }
}
