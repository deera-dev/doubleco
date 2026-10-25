import { CircleCheck, ScanLine, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { signal } from '@/features/scan/lib/feedback'
import { useDeleteInspection, useInspectCard } from '@/features/sewing-cards/api/mutations'
import type { Inspection, ScannedCard } from '@/features/sewing-cards/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const decisionLabel = {
  pending: 'menunggu keputusan owner',
  deduct: 'dipotong',
  waive: 'tidak dipotong',
}

/** Pieces still to be judged: everything not yet OK or written off (repairable ones come back). */
export function uninspectedQuantity(card: ScannedCard): number {
  return card.inspections.reduce((left, round) => left - round.ok - round.defective, card.quantity)
}

function History({ inspections }: { inspections: Inspection[] }) {
  if (inspections.length === 0) return null
  return (
    <ol className="space-y-2">
      {inspections.map((round) => (
        <li key={round.id} className="rounded-2xl border bg-background/40 px-4 py-3 text-sm">
          <p className="font-medium">
            Pemeriksaan {round.round} · {formatWorkOrderDate(round.inspectedOn)}
          </p>
          <p className="text-muted-foreground">
            {[
              `OK ${round.ok}`,
              round.repairable > 0 ? `perbaikan ${round.repairable}` : null,
              round.defective > 0 ? `rusak ${round.defective}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {round.notes ? ` · ${round.notes}` : ''}
          </p>
          {round.deductionAmount !== null && round.deductionDecision && (
            <p className="text-warning text-xs">
              Usulan potongan {formatRupiah(round.deductionAmount)} ·{' '}
              {decisionLabel[round.deductionDecision]}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

function QuantityField({
  id,
  label,
  value,
  onChange,
  tone,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  tone?: 'warning' | 'destructive'
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className={cn(
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        className="h-12 text-center font-mono text-lg"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      />
    </div>
  )
}

function InspectForm({
  card,
  today,
  onDone,
}: {
  card: ScannedCard
  today: string
  onDone: () => void
}) {
  const inspect = useInspectCard()
  const left = uninspectedQuantity(card)
  const [ok, setOk] = useState(String(left))
  const [repairable, setRepairable] = useState('0')
  const [defective, setDefective] = useState('0')
  const [notes, setNotes] = useState('')
  const [inspectedOn, setInspectedOn] = useState(today)
  const total = Number(ok || 0) + Number(repairable || 0) + Number(defective || 0)
  const ratePerPiece = card.quantity > 0 ? card.wageAmount / card.quantity : 0
  const isValid = total > 0 && total <= left

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isValid) return
    inspect.mutate(
      {
        number: card.number,
        ok: Number(ok || 0),
        repairable: Number(repairable || 0),
        defective: Number(defective || 0),
        notes: notes.trim() || null,
        inspectedOn,
      },
      {
        onSuccess: () => {
          signal('saved')
          toast.success(`${card.number} diperiksa`)
          onDone()
        },
        onError: () => signal('blocked'),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Belum diperiksa: <span className="font-mono font-semibold text-foreground">{left}</span> pcs
        {card.inspectionStatus === 'in_repair' ? ' (termasuk yang kembali dari perbaikan)' : ''}.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <QuantityField id="inspect-ok" label="OK" value={ok} onChange={setOk} />
        <QuantityField
          id="inspect-repair"
          label="Perbaikan"
          value={repairable}
          onChange={setRepairable}
          tone="warning"
        />
        <QuantityField
          id="inspect-defective"
          label="Rusak"
          value={defective}
          onChange={setDefective}
          tone="destructive"
        />
      </div>
      {total > left && (
        <p className="text-destructive text-sm">
          Total {total} pcs melebihi yang belum diperiksa ({left} pcs).
        </p>
      )}
      {Number(repairable || 0) > 0 && (
        <p className="text-sm text-warning">
          {repairable} pcs dikembalikan ke {card.tailorName ?? 'penjahit'} untuk diperbaiki, lalu
          diperiksa ulang. Tidak menambah upah.
        </p>
      )}
      {Number(defective || 0) > 0 && (
        <p className="text-destructive text-sm">
          Rusak permanen dicatat sebagai usulan potongan{' '}
          {formatRupiah(Math.round(Number(defective) * ratePerPiece))}, menunggu keputusan owner di
          menu Gajian.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inspect-notes">Keterangan (opsional)</Label>
          <Textarea
            id="inspect-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Mis. jahitan lengan miring"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inspect-date">Tanggal periksa</Label>
          <Input
            id="inspect-date"
            type="date"
            className="h-12"
            value={inspectedOn}
            onChange={(event) => setInspectedOn(event.target.value)}
          />
        </div>
      </div>
      {inspect.error && (
        <p role="alert" className="text-destructive text-sm">
          {describeError(inspect.error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" onClick={onDone}>
          Scan kartu lain
        </Button>
        <Button type="submit" size="lg" disabled={!isValid || inspect.isPending}>
          <CircleCheck />
          {inspect.isPending ? 'Menyimpan…' : 'Catat pemeriksaan'}
        </Button>
      </div>
    </form>
  )
}

function DeleteLastDialog({ card, onClose }: { card: ScannedCard; onClose: () => void }) {
  const remove = useDeleteInspection()
  const [reason, setReason] = useState('')
  const last = card.inspections.at(-1)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus pemeriksaan {last?.round}?</DialogTitle>
          <DialogDescription>
            Pakai ini jika salah input. Usulan potongan dari pemeriksaan ini ikut terhapus.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="inspection-reason">Alasan</Label>
          <Textarea
            id="inspection-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. salah ketik jumlah rusak"
          />
          {remove.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(remove.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Kembali
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={reason.trim() === '' || remove.isPending}
            onClick={() =>
              remove.mutate(
                { number: card.number, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Pemeriksaan dihapus')
                    onClose()
                  },
                },
              )
            }
          >
            {remove.isPending ? 'Menghapus…' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InspectionPanel({
  card,
  today,
  onDone,
}: {
  card: ScannedCard
  today: string
  onDone: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const isDone = card.inspectionStatus === 'done'

  return (
    <div className="space-y-4">
      <History inspections={card.inspections} />
      {isDone ? (
        <>
          <div className="flex gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="font-semibold text-success">Kartu ini sudah selesai diperiksa.</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={() => setIsDeleting(true)}>
              <Trash2 />
              Hapus pemeriksaan terakhir
            </Button>
            <Button type="button" size="lg" onClick={onDone}>
              <ScanLine />
              Scan kartu lain
            </Button>
          </div>
        </>
      ) : (
        <InspectForm card={card} today={today} onDone={onDone} />
      )}
      {isDeleting && <DeleteLastDialog card={card} onClose={() => setIsDeleting(false)} />}
    </div>
  )
}
