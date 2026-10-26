import { ChevronDown, CircleCheck, Pencil, Plus, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useMarkPaid, useRemoveAddition } from '@/features/payroll/api/mutations'
import type { PayrollLine } from '@/features/payroll/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const kindLabels = { thr: 'THR', bonus: 'Bonus', other: 'Tambahan' }

const paidAtFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function Row({
  label,
  amount,
  sign,
  action,
}: {
  label: string
  amount: number
  sign: '+' | '−'
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            'font-mono tabular-nums',
            sign === '−' && amount > 0
              ? 'text-destructive'
              : amount > 0
                ? 'text-foreground'
                : 'text-subtle-foreground',
          )}
        >
          {sign}
          {formatRupiah(amount)}
        </span>
        {action}
      </span>
    </div>
  )
}

interface PayrollLineCardProps {
  line: PayrollLine
  isLocked: boolean
  onEditRepayment: () => void
  onAddAddition: () => void
}

export function PayrollLineCard({
  line,
  isLocked,
  onEditRepayment,
  onAddAddition,
}: PayrollLineCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const markPaid = useMarkPaid()
  const removeAddition = useRemoveAddition()
  const isNegative = line.transferAmount < 0

  return (
    <article
      className={cn(
        'surface space-y-3 rounded-3xl p-4 sm:p-5',
        line.status === 'paid' && 'border-success/40',
      )}
    >
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-border-strong bg-background/60">
          <span className="font-mono font-semibold text-sm leading-none">{line.code}</span>
          <span className="mt-0.5 text-subtle-foreground text-xs leading-none">kode</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{line.name}</p>
          {line.account ? (
            <p className="truncate text-muted-foreground text-xs">
              {line.account.provider} · <span className="font-mono">{line.account.number}</span> ·{' '}
              {line.account.holder}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-warning text-xs">
              <TriangleAlert className="size-3.5" />
              Belum ada rekening
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-muted-foreground text-xs">Transfer</p>
          <p
            className={cn(
              'font-mono font-semibold text-lg tabular-nums',
              isNegative ? 'text-destructive' : 'text-foreground',
            )}
          >
            {formatRupiah(line.transferAmount)}
          </p>
        </div>
      </header>

      <div className="divide-y rounded-2xl border bg-background/40 px-4">
        <Row
          label={`Upah · ${line.cards.length} kartu · ${line.pieces} pcs`}
          amount={line.grossWage}
          sign="+"
        />
        {line.additionTotal > 0 && <Row label="Tambahan" amount={line.additionTotal} sign="+" />}
        {line.newAdvanceTotal > 0 && (
          <Row label="Kasbon baru" amount={line.newAdvanceTotal} sign="+" />
        )}
        {line.deductionTotal > 0 && (
          <Row label="Potongan rusak" amount={line.deductionTotal} sign="−" />
        )}
        {(line.advanceRepayment > 0 || line.advanceBalance > 0) && (
          <Row
            label={
              isLocked
                ? 'Cicilan kasbon'
                : `Cicilan kasbon · sisa ${formatRupiah(line.advanceBalance)}`
            }
            amount={line.advanceRepayment}
            sign="−"
            action={
              !isLocked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  aria-label={`Ubah cicilan ${line.name}`}
                  onClick={onEditRepayment}
                >
                  <Pencil className="size-3.5" />
                  Ubah
                </Button>
              )
            }
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
          Rincian
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {!isLocked && (
            <Button type="button" variant="outline" size="sm" onClick={onAddAddition}>
              <Plus />
              Tambahan
            </Button>
          )}
          {isLocked &&
            (line.status === 'paid' ? (
              <span className="flex items-center gap-1 text-sm text-success">
                <CircleCheck className="size-4" />
                Dibayar {line.paidAt ? paidAtFormat.format(new Date(line.paidAt)) : ''}
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={markPaid.isPending}
                onClick={() =>
                  markPaid.mutate(
                    { lineId: line.id },
                    {
                      onSuccess: () => toast.success(`${line.name} ditandai dibayar`),
                      onError: (error) => toast.error(describeError(error)),
                    },
                  )
                }
              >
                <CircleCheck />
                Tandai dibayar
              </Button>
            ))}
        </div>
      </div>

      {isOpen && (
        <div className="animate-rise space-y-3 text-sm">
          {line.cards.length > 0 && (
            <ul className="divide-y rounded-2xl border">
              {line.cards.map((card) => (
                <li key={card.number} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {card.productCode} · {card.sizeName} · {card.colorName}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      <span className="font-mono">{card.number}</span> · kategori {card.category}
                      {card.submittedOn ? ` · setor ${formatWorkOrderDate(card.submittedOn)}` : ''}
                      {card.incomplete ? ' · belum selesai' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono tabular-nums">{formatRupiah(card.wage)}</span>
                    <span className="block text-muted-foreground text-xs">{card.quantity} pcs</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {line.additions.map((addition) => (
            <div key={addition.id} className="flex items-center gap-3 rounded-2xl border px-4 py-2">
              <span className="min-w-0 flex-1 truncate">
                {kindLabels[addition.kind]}
                {addition.notes &&
                addition.notes.toLowerCase() !== kindLabels[addition.kind].toLowerCase()
                  ? ` · ${addition.notes}`
                  : ''}
              </span>
              <span className="font-mono tabular-nums">{formatRupiah(addition.amount)}</span>
              {!isLocked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Hapus tambahan"
                  disabled={removeAddition.isPending}
                  onClick={() =>
                    removeAddition.mutate(
                      { id: addition.id, reason: null },
                      { onError: (error) => toast.error(describeError(error)) },
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {line.deductions.map((deduction) => (
            <p key={deduction.id} className="text-muted-foreground">
              Potongan {deduction.quantity} pcs rusak dari{' '}
              <span className="font-mono">{deduction.cardNumber}</span> ·{' '}
              {formatRupiah(deduction.amount)}
            </p>
          ))}
          {line.newAdvances.map((advance) => (
            <p key={advance.id} className="text-muted-foreground">
              Kasbon {formatWorkOrderDate(advance.entryOn)} · {formatRupiah(advance.amount)}
            </p>
          ))}
        </div>
      )}
    </article>
  )
}
