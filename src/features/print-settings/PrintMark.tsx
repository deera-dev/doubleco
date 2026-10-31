import { Printer } from 'lucide-react'
import type { PrintMark } from '@/features/print-settings/api'
import { cn } from '@/shared/lib/utils'

const printedAt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function describePrintMark(mark: PrintMark): string {
  return `Sudah dicetak ${mark.count}× · terakhir ${printedAt.format(new Date(mark.lastAt))}`
}

/** "Dicetak 2×" chip; nothing when the document was never printed. */
export function PrintMarkBadge({
  mark,
  label = 'Dicetak',
  className,
}: {
  mark: PrintMark | undefined
  /** What was printed, e.g. "THP"; the count follows. */
  label?: string
  className?: string
}) {
  if (!mark) return null
  return (
    <span
      title={describePrintMark(mark)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success text-xs',
        className,
      )}
    >
      <Printer className="size-3" />
      {label} {mark.count}×
    </span>
  )
}
