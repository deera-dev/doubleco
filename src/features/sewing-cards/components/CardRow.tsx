import { Link } from '@tanstack/react-router'
import { Ban, Check, Pencil, Printer } from 'lucide-react'
import type { SewingCard } from '@/features/sewing-cards/api/schema'
import { cardPrintSearch, cardStatusMeta } from '@/features/sewing-cards/lib/status'
import { useSewingCardsUiStore } from '@/features/sewing-cards/store'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
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
  const status = cardStatusMeta[card.status]
  const isOpen = card.status === 'taken'

  return (
    <div
      className={cn(
        'surface flex items-center gap-3 rounded-2xl p-3 pr-2 transition-colors sm:gap-4 sm:p-4 sm:pr-3',
        isSelected && 'border-brand-400/50 bg-brand-500/10',
        card.status === 'cancelled' && 'opacity-60',
      )}
    >
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
          {card.tailorCode ?? '—'}
        </span>
        <span className="mt-0.5 text-subtle-foreground text-xs leading-none">kode</span>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'truncate font-medium text-sm',
              !card.tailorName && 'text-muted-foreground',
            )}
          >
            {card.tailorName ?? 'Belum dicatat'}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', status.className)}>
            {status.label}
          </span>
        </span>
        <span className="line-clamp-2 text-muted-foreground text-xs">
          <span className="text-foreground">{itemLabel(card.sizeName, card.colorName)}</span>
          {showWorkOrder ? ` · ${card.productCode}` : ''} ·{' '}
          <span className="font-mono">{card.number}</span> · {formatWorkOrderDate(card.takenOn)}
        </span>
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
        {isOpen && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Ubah ${card.number}`}
              onClick={() => openDialog({ kind: 'edit', card })}
            >
              <Pencil />
            </Button>
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
          </>
        )}
      </span>
    </div>
  )
}
