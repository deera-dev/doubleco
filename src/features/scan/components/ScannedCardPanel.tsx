import { Ban, CircleCheck, ClipboardCheck, OctagonAlert, ScanLine, Undo2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { InspectionPanel } from '@/features/scan/components/InspectionPanel'
import { signal } from '@/features/scan/lib/feedback'
import { formatSubmittedAt } from '@/features/scan/lib/format'
import { type ScanMode, useScanUiStore } from '@/features/scan/store'
import { useSubmitCard, useUnsubmitCard } from '@/features/sewing-cards/api/mutations'
import type { ScannedCard, ScanTailor } from '@/features/sewing-cards/api/schema'
import { cardStatusMeta } from '@/features/sewing-cards/lib/status'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
import { Button } from '@/shared/components/ui/button'
import { Combobox } from '@/shared/components/ui/combobox'
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
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { labelKey } from '@/shared/lib/labels'
import { cn } from '@/shared/lib/utils'
import { confirmationWarnings } from '@/shared/lib/warnings'

function tailorLabel(tailor: ScanTailor): string {
  return `${tailor.code} · ${tailor.name}`
}

/** Matches what was written on the card: the code alone, or "code · name". */
function resolveTailor(tailors: ScanTailor[], text: string): ScanTailor | undefined {
  const key = labelKey(text)
  if (key === '') return undefined
  return (
    tailors.find((tailor) => labelKey(tailorLabel(tailor)) === key) ??
    tailors.find((tailor) => labelKey(tailor.code) === key)
  )
}

function CardSummary({ card }: { card: ScannedCard }) {
  const status = cardStatusMeta[card.status]
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold">{card.number}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', status.className)}>
            {status.label}
          </span>
        </div>
        <p className="font-semibold text-lg leading-tight">
          {card.productCode} · {card.sizeName} ·{' '}
          <span className="text-brand-200">{card.colorName}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          {card.workOrderNumber} · ambil {formatWorkOrderDate(card.takenOn)} · kategori{' '}
          {card.category}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono font-semibold text-4xl tabular-nums leading-none">
          {card.quantity}
        </p>
        <p className="text-muted-foreground text-xs">pcs</p>
      </div>
    </div>
  )
}

interface SubmitFormProps {
  card: ScannedCard
  tailors: ScanTailor[]
  today: string
  onDone: () => void
}

function SubmitForm({ card, tailors, today, onDone }: SubmitFormProps) {
  const submitCard = useSubmitCard()
  const lastTailorId = useScanUiStore((state) => state.lastTailorId)
  const setLastTailorId = useScanUiStore((state) => state.setLastTailorId)
  const initialTailor = tailors.find((tailor) => tailor.id === (card.tailorId ?? lastTailorId))
  const [tailorText, setTailorText] = useState(initialTailor ? tailorLabel(initialTailor) : '')
  const [submittedOn, setSubmittedOn] = useState(today)
  const [isIncomplete, setIsIncomplete] = useState(false)
  const [notes, setNotes] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const tailor = resolveTailor(tailors, tailorText)
  const warnings = confirmationWarnings(submitCard.error)
  const canSubmit = tailor !== undefined && (!isIncomplete || notes.trim() !== '')

  const save = (confirmed: boolean) => {
    if (!tailor) return
    submitCard.mutate(
      {
        number: card.number,
        tailorId: tailor.id === card.tailorId ? null : tailor.id,
        submittedOn,
        incomplete: isIncomplete,
        remainingNotes: isIncomplete ? notes.trim() : null,
        confirmed,
        reason: confirmed ? 'Dikonfirmasi saat scan setor' : null,
      },
      {
        onSuccess: () => {
          signal('saved')
          setLastTailorId(tailor.id)
          setIsConfirming(false)
          toast.success(`${card.number} disetor · ${tailor.name}`)
          onDone()
        },
        onError: (error) => {
          const needsConfirm = confirmationWarnings(error) !== null
          setIsConfirming(needsConfirm)
          if (!needsConfirm) signal('blocked')
        },
      },
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canSubmit) save(false)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scan-tailor">Penjahit yang setor</Label>
          <Combobox
            id="scan-tailor"
            value={tailorText}
            onValueChange={setTailorText}
            inputMode="numeric"
            placeholder="Kode di kartu, mis. 29"
            options={tailors.map((candidate) => ({ label: tailorLabel(candidate) }))}
            aria-invalid={tailorText.trim() !== '' && !tailor}
          />
          {tailorText.trim() !== '' && !tailor ? (
            <p className="text-destructive text-xs">Penjahit tidak ditemukan.</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {card.tailorId
                ? 'Sudah tercatat di kartu. Ganti jika yang setor orang lain.'
                : 'Sesuai nama dan kode yang ditulis di kartu.'}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="scan-date">Tanggal setor</Label>
          <Input
            id="scan-date"
            type="date"
            className="h-12"
            value={submittedOn}
            onChange={(event) => setSubmittedOn(event.target.value)}
          />
        </div>
      </div>
      <Switch
        checked={isIncomplete}
        onCheckedChange={setIsIncomplete}
        label="Belum selesai 100%"
        description="Tetap dibayar penuh. Sisa pekerjaan dipantau sampai diserahkan."
      />
      {isIncomplete && (
        <div className="space-y-2">
          <Label htmlFor="scan-notes">Sisa pekerjaan</Label>
          <Textarea
            id="scan-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Mis. 3 pcs belum dipasang kancing"
          />
        </div>
      )}
      {submitCard.error && !warnings && (
        <p role="alert" className="text-destructive text-sm">
          {describeError(submitCard.error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" onClick={onDone}>
          Scan kartu lain
        </Button>
        <Button type="submit" size="lg" disabled={!canSubmit || submitCard.isPending}>
          <CircleCheck />
          {submitCard.isPending ? 'Menyimpan…' : 'Catat setor'}
        </Button>
      </div>
      <ConfirmWarningsDialog
        warnings={isConfirming ? warnings : null}
        isPending={submitCard.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => save(true)}
      />
    </form>
  )
}

function UnsubmitDialog({ card, onClose }: { card: ScannedCard; onClose: () => void }) {
  const unsubmit = useUnsubmitCard()
  const [reason, setReason] = useState('')

  const save = () =>
    unsubmit.mutate(
      { number: card.number, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Setoran ${card.number} dibatalkan`)
          onClose()
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan setoran {card.number}?</DialogTitle>
          <DialogDescription>
            Kartu kembali berstatus di penjahit dan keluar dari gajian. Pakai ini hanya untuk salah
            scan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="unsubmit-reason">Alasan</Label>
          <Textarea
            id="unsubmit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. salah scan, kartunya belum disetor"
          />
          {unsubmit.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(unsubmit.error)}
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
            disabled={reason.trim() === '' || unsubmit.isPending}
            onClick={save}
          >
            {unsubmit.isPending ? 'Membatalkan…' : 'Batalkan setoran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Blocked({ card, onDone }: { card: ScannedCard; onDone: () => void }) {
  const [isUnsubmitting, setIsUnsubmitting] = useState(false)
  const setMode = useScanUiStore((state) => state.setMode)
  const canInspect = card.status !== 'cancelled' && card.inspectionStatus !== 'done'
  const title =
    card.status === 'cancelled'
      ? 'Kartu ini sudah dibatalkan'
      : card.status === 'paid'
        ? 'Kartu ini sudah dibayar'
        : 'Kartu ini sudah disetor'
  const when = card.submittedAt ? formatSubmittedAt(card.submittedAt) : null

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        {card.status === 'cancelled' ? (
          <Ban className="mt-0.5 size-5 shrink-0 text-destructive" />
        ) : (
          <OctagonAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        )}
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-destructive">{title}</p>
          {card.status === 'cancelled' ? (
            <p className="text-muted-foreground">Kartu fisiknya jangan dipakai lagi.</p>
          ) : (
            <p className="text-muted-foreground">
              {[
                when ? `Disetor ${when}` : null,
                card.tailorName ? `oleh ${card.tailorName} (kode ${card.tailorCode})` : null,
                card.submittedByName ? `dicatat ${card.submittedByName}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              {card.submittedIncomplete && card.remainingNotes
                ? `. Belum selesai: ${card.remainingNotes}`
                : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {card.status === 'submitted' && (
          <Button type="button" variant="ghost" size="lg" onClick={() => setIsUnsubmitting(true)}>
            <Undo2 />
            Batalkan setoran
          </Button>
        )}
        {canInspect && (
          <Button type="button" variant="outline" size="lg" onClick={() => setMode('inspect')}>
            <ClipboardCheck />
            Periksa kartu ini
          </Button>
        )}
        <Button type="button" size="lg" onClick={onDone}>
          <ScanLine />
          Scan kartu lain
        </Button>
      </div>
      {isUnsubmitting && (
        <UnsubmitDialog
          card={card}
          onClose={() => {
            setIsUnsubmitting(false)
            onDone()
          }}
        />
      )}
    </div>
  )
}

function NotSubmitted({ onDone }: { onDone: () => void }) {
  const setMode = useScanUiStore((state) => state.setMode)
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <OctagonAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <p className="font-semibold text-warning">
          Kartu ini belum disetor. Catat setornya dulu, baru bisa diperiksa.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" onClick={onDone}>
          Scan kartu lain
        </Button>
        <Button type="button" size="lg" onClick={() => setMode('submit')}>
          <CircleCheck />
          Catat setor
        </Button>
      </div>
    </div>
  )
}

/** Whether a scan landed on a card that can be worked on in this mode (drives sound and border). */
export function isActionable(card: ScannedCard, mode: ScanMode): boolean {
  if (mode === 'submit') return card.status === 'taken'
  return (card.status === 'submitted' || card.status === 'paid') && card.inspectionStatus !== 'done'
}

interface ScannedCardPanelProps {
  card: ScannedCard
  tailors: ScanTailor[]
  today: string
  onDone: () => void
}

export function ScannedCardPanel({ card, tailors, today, onDone }: ScannedCardPanelProps) {
  const mode = useScanUiStore((state) => state.mode)
  const isCancelled = card.status === 'cancelled'

  return (
    <section
      className={cn(
        'surface animate-rise space-y-5 rounded-3xl p-5 sm:p-6',
        isActionable(card, mode) ? 'border-brand-400/50' : 'border-destructive/50',
      )}
    >
      <CardSummary card={card} />
      {mode === 'submit' || isCancelled ? (
        card.status === 'taken' ? (
          <SubmitForm card={card} tailors={tailors} today={today} onDone={onDone} />
        ) : (
          <Blocked card={card} onDone={onDone} />
        )
      ) : card.status === 'taken' ? (
        <NotSubmitted onDone={onDone} />
      ) : (
        <InspectionPanel card={card} today={today} onDone={onDone} />
      )}
    </section>
  )
}
