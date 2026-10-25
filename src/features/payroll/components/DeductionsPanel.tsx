import { Scale } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useDecideDeduction } from '@/features/payroll/api/mutations'
import type { PendingDeduction } from '@/features/payroll/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'

function DeductionRow({ deduction }: { deduction: PendingDeduction }) {
  const decide = useDecideDeduction()
  const [notes, setNotes] = useState('')

  const choose = (decision: 'deduct' | 'waive') =>
    decide.mutate(
      { id: deduction.id, decision, notes: notes.trim() || null },
      {
        onSuccess: () =>
          toast.success(
            decision === 'deduct'
              ? `${deduction.tailorName}: dipotong ${formatRupiah(deduction.amount)}`
              : `${deduction.tailorName}: tidak dipotong`,
          ),
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <li className="space-y-3 rounded-2xl border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-sm">
            {deduction.tailorCode} · {deduction.tailorName}
          </p>
          <p className="text-muted-foreground text-xs">
            <span className="font-mono">{deduction.cardNumber}</span> · {deduction.quantity} pcs
            rusak permanen
            {deduction.inspectedOn
              ? ` · diperiksa ${formatWorkOrderDate(deduction.inspectedOn)}`
              : ''}
            {deduction.notes ? ` · ${deduction.notes}` : ''}
          </p>
        </div>
        <p className="shrink-0 font-mono font-semibold text-destructive tabular-nums">
          {formatRupiah(deduction.amount)}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Catatan keputusan owner (opsional)"
          aria-label="Catatan keputusan"
          className="h-11 flex-1"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={decide.isPending}
            onClick={() => choose('waive')}
          >
            Tidak dipotong
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={decide.isPending}
            onClick={() => choose('deduct')}
          >
            Potong
          </Button>
        </div>
      </div>
    </li>
  )
}

export function DeductionsPanel({ deductions }: { deductions: PendingDeduction[] }) {
  if (deductions.length === 0) return null
  return (
    <section className="surface space-y-4 rounded-3xl border-warning/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
          <Scale className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="font-semibold">Usulan potongan menunggu keputusan owner</h2>
          <p className="text-muted-foreground text-sm">
            Dari pemeriksaan rusak permanen. Yang dipotong masuk ke gajian yang masih terbuka.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {deductions.map((deduction) => (
          <DeductionRow key={deduction.id} deduction={deduction} />
        ))}
      </ul>
    </section>
  )
}
