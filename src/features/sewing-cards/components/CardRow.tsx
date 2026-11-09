import { Link } from '@tanstack/react-router'
import { Ban, Check, CheckCheck, Pencil, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useDeliverRemaining } from '@/features/sewing-cards/api/mutations'
import type { SewingCard } from '@/features/sewing-cards/api/schema'
import { cardPrintSearch, cardStatusMeta, unfinishedMeta } from '@/features/sewing-cards/lib/status'
import { useSewingCardsUiStore } from '@/features/sewing-cards/store'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { itemLabel } from '@/shared/lib/item-label'
import { cn } from '@/shared/lib/utils'

interface CardRowProps {
  card: SewingCard
  isSelected?: boolean
  onToggle?: () => void
  showWorkOrder?: boolean
}

export function CardRow({
  card,
  isSelected = false,
  onToggle,
  showWorkOrder = true,
}: CardRowProps) {
  const openDialog = useSewingCardsUiStore((state) => state.openDialog)
  const deliver = useDeliverRemaining()
  const isUnfinished = card.remainingPending && card.status !== 'cancelled'
  // A paid card that is not done yet shows only as Belum tuntas; a handed-in one keeps Disetor.
  const status =
    isUnfinished && card.status === 'paid' ? unfinishedMeta : cardStatusMeta[card.status]
  const markComplete = () =>
    deliver.mutate(
      { number: card.number },
      {
        onSuccess: () =>
          toast.success(
            `${card.number} lengkap · kembali ke ${cardStatusMeta[card.status].label.toLowerCase()}`,
          ),
        onError: (error) => toast.error(describeError(error)),
      },
    )
  // Taken and handed-in cards can be corrected; paid ones need their payroll reopened first.
  const isCorrectable = card.status !== 'cancelled'

  return (
    <div
      className={cn(
        'surface rounded-2xl transition-colors',
        isSelected && 'border-brand-400/50 bg-brand-500/10',
        isUnfinished && 'border-destructive/70! bg-destructive/5',
        card.status === 'cancelled' && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3 p-3 pr-2 sm:gap-4 sm:p-4 sm:pr-3">
        {onToggle && (
          <button
            type="button"
            aria-pressed={isSelected}
            aria-label={`Pilih ${card.number}`}
            onClick={onToggle}
            className={cn(
              'interactive flex size-6 shrink-0 items-center justify-center rounded-lg border border-border-strong',
              isSelected && 'sheen-primary border-transparent text-primary-foreground',
            )}
          >
            {isSelected && <Check className="size-3.5" />}
          </button>
        )}
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-border-strong bg-background/60">
          <span className="font-mono font-semibold text-sm leading-none">
            {card.cmtCode ?? card.tailorCode ?? '—'}
          </span>
          <span className="mt-0.5 text-subtle-foreground text-xs leading-none">
            {card.cmtCode ? 'CMT' : 'kode'}
          </span>
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'truncate font-medium text-sm',
                !card.tailorName && !card.cmtName && 'text-muted-foreground',
              )}
            >
              {card.cmtName ?? card.tailorName ?? 'Belum dicatat'}
            </span>
            {card.cmtName && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning text-xs">
                CMT luar
              </span>
            )}
            <span className={cn('rounded-full border px-2 py-0.5 text-xs', status.className)}>
              {status.label}
            </span>
            {isUnfinished && card.status !== 'paid' && (
              <span
                className={cn('rounded-full border px-2 py-0.5 text-xs', unfinishedMeta.className)}
              >
                {unfinishedMeta.label}
              </span>
            )}
            {card.printCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success text-xs">
                <Printer className="size-3" />
                Dicetak {card.printCount}×
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-muted-foreground text-xs">
            <span className="text-foreground">{itemLabel(card.sizeName, card.colorName)}</span>
            {showWorkOrder ? ` · ${card.productCode}` : ''} ·{' '}
            <span className="font-mono">{card.number}</span> · {formatWorkOrderDate(card.takenOn)}
          </span>
          {isUnfinished && card.remainingNotes && (
            <span className="block text-destructive text-xs">Sisa: {card.remainingNotes}</span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono font-semibold text-lg tabular-nums leading-none">
            {card.quantity}
          </span>
          <span className="text-subtle-foreground text-xs">pcs</span>
        </span>
        <span className="flex shrink-0 items-center">
          {card.status !== 'cancelled' && (
            <Button asChild variant="ghost" size="icon" aria-label={`Cetak ${card.number}`}>
              <Link to="/cetak/kartu-jahit" search={cardPrintSearch([card.number])}>
                <Printer />
              </Link>
            </Button>
          )}
          {isCorrectable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Ubah ${card.number}`}
              onClick={() => openDialog({ kind: 'edit', card })}
            >
              <Pencil />
            </Button>
          )}
          {card.status === 'taken' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Batalkan ${card.number}`}
              className="hidden text-muted-foreground hover:text-destructive sm:inline-flex"
              onClick={() => openDialog({ kind: 'cancel', card })}
            >
              <Ban />
            </Button>
          )}
        </span>
      </div>
      {isUnfinished && (
        <div className="flex flex-col gap-2 border-destructive/30 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-muted-foreground text-xs">
            Sisa jahitan sudah disetor semua? Tandai lengkap.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-9 font-semibold"
            disabled={deliver.isPending}
            onClick={markComplete}
          >
            <CheckCheck />
            {deliver.isPending ? 'Menyimpan…' : 'Tandai lengkap'}
          </Button>
        </div>
      )}
    </div>
  )
}
