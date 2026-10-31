import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  useAddAddition,
  useLockPayroll,
  useSetRepayment,
  useSetSamples,
  useUnlockPayroll,
} from '@/features/payroll/api/mutations'
import { usePayrollTailors } from '@/features/payroll/api/queries'
import type { AdditionKind, PayrollLine, PayrollOverview } from '@/features/payroll/api/schema'
import { formatPayDay } from '@/features/payroll/lib/dates'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
import { MoneyInput } from '@/shared/components/MoneyInput'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
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
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { labelKey } from '@/shared/lib/labels'
import { confirmationWarnings } from '@/shared/lib/warnings'

export function RepaymentDialog({ line, onClose }: { line: PayrollLine; onClose: () => void }) {
  const setRepayment = useSetRepayment()
  const [amount, setAmount] = useState<number | null>(line.advanceRepayment)
  const [isConfirming, setIsConfirming] = useState(false)
  const warnings = confirmationWarnings(setRepayment.error)
  const value = amount ?? 0
  const transferAfter = line.transferAmount + line.advanceRepayment - value

  const save = (confirmed: boolean) =>
    setRepayment.mutate(
      {
        lineId: line.id,
        amount: value,
        confirmed,
        reason: confirmed ? 'Dikonfirmasi di gajian' : null,
      },
      {
        onSuccess: () => {
          toast.success(`Cicilan ${line.name}: ${formatRupiah(value)}`)
          onClose()
        },
        onError: (error) => setIsConfirming(confirmationWarnings(error) !== null),
      },
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save(false)
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sheet-above-keyboard">
          <DialogHeader>
            <DialogTitle>Cicilan kasbon · {line.name}</DialogTitle>
            <DialogDescription>
              Sisa kasbon {formatRupiah(line.advanceBalance)}. Dipotong dari transfer minggu ini dan
              tercatat di buku kasbon saat gajian dikunci.
            </DialogDescription>
          </DialogHeader>
          <form id="repayment-form" onSubmit={submit} noValidate className="space-y-3">
            <Label htmlFor="repayment-amount">Cicilan minggu ini</Label>
            <MoneyInput
              id="repayment-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
            />
            <div className="flex flex-wrap gap-2">
              {[0, 50_000, 100_000, line.advanceBalance]
                .filter((preset, index, all) => preset >= 0 && all.indexOf(preset) === index)
                .map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(preset)}
                  >
                    {preset === line.advanceBalance && preset > 0
                      ? `Lunas ${formatRupiah(preset)}`
                      : formatRupiah(preset)}
                  </Button>
                ))}
            </div>
            <p className="text-muted-foreground text-sm">
              Transfer jadi{' '}
              <span className="font-mono font-semibold text-foreground">
                {formatRupiah(transferAfter)}
              </span>
            </p>
            {setRepayment.error && !warnings && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(setRepayment.error)}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" form="repayment-form" size="lg" disabled={setRepayment.isPending}>
              {setRepayment.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmWarningsDialog
        warnings={isConfirming ? warnings : null}
        isPending={setRepayment.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => save(true)}
      />
    </>
  )
}

const kindLabels: Record<AdditionKind, string> = { thr: 'THR', bonus: 'Bonus', other: 'Lainnya' }

export function AdditionDialog({
  payOn,
  line,
  onClose,
}: {
  payOn: string
  line: PayrollLine | null
  onClose: () => void
}) {
  const tailors = usePayrollTailors()
  const addAddition = useAddAddition()
  const [tailorText, setTailorText] = useState(line ? `${line.code} · ${line.name}` : '')
  // From a tailor's card it is usually a one-off extra; from the page it is usually THR/bonus.
  const [kind, setKind] = useState<AdditionKind>(line ? 'other' : 'bonus')
  const [amount, setAmount] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const options = tailors.data?.tailors ?? []
  const key = labelKey(tailorText)
  const tailor =
    (line && { id: line.tailorId, name: line.name }) ??
    options.find((candidate) => labelKey(`${candidate.code} · ${candidate.name}`) === key) ??
    options.find((candidate) => labelKey(candidate.code) === key)
  const canSave = tailor !== undefined && amount !== null && amount > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!tailor || amount === null) return
    addAddition.mutate(
      { payOn, tailorId: tailor.id, kind, amount, notes: notes.trim() || null },
      {
        onSuccess: () => {
          toast.success(`${kindLabels[kind]} ${formatRupiah(amount)} · ${tailor.name}`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sheet-above-keyboard">
        <DialogHeader>
          <DialogTitle>Tambahan gaji</DialogTitle>
          <DialogDescription>
            THR, bonus, atau tambahan lain. Masuk ke transfer gajian {formatPayDay(payOn)}.
          </DialogDescription>
        </DialogHeader>
        <form id="addition-form" onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addition-tailor">Penjahit</Label>
            {line ? (
              <p className="rounded-xl border px-4 py-3 font-medium text-sm">
                {line.code} · {line.name}
              </p>
            ) : (
              <Combobox
                id="addition-tailor"
                value={tailorText}
                onValueChange={setTailorText}
                placeholder="Ketik kode / nama"
                options={options.map((candidate) => ({
                  label: `${candidate.code} · ${candidate.name}`,
                }))}
              />
            )}
          </div>
          <SegmentedControl
            label="Jenis tambahan"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'bonus', label: 'Bonus' },
              { value: 'thr', label: 'THR' },
              { value: 'other', label: 'Lainnya' },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="addition-amount">Jumlah</Label>
            <MoneyInput
              id="addition-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addition-notes">Catatan (opsional)</Label>
            <Textarea
              id="addition-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {addAddition.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(addAddition.error)}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            form="addition-form"
            size="lg"
            disabled={!canSave || addAddition.isPending}
          >
            {addAddition.isPending ? 'Menyimpan…' : 'Tambahkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LockDialog({
  overview,
  onClose,
}: {
  overview: PayrollOverview
  onClose: () => void
}) {
  const lock = useLockPayroll()
  const [isConfirming, setIsConfirming] = useState(false)
  const warnings = confirmationWarnings(lock.error)

  const save = (confirmed: boolean) =>
    lock.mutate(
      {
        payOn: overview.payOn,
        confirmed,
        reason: confirmed ? 'Dikonfirmasi saat kunci gajian' : null,
      },
      {
        onSuccess: () => {
          toast.success(`Gajian ${formatPayDay(overview.payOn)} dikunci`)
          onClose()
        },
        onError: (error) => setIsConfirming(confirmationWarnings(error) !== null),
      },
    )

  return (
    <>
      <Dialog open={!isConfirming} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunci gajian {formatPayDay(overview.payOn)}?</DialogTitle>
            <DialogDescription>
              Rekap dihitung ulang sekali lagi, lalu angka dibekukan untuk ditransfer.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              {overview.totals.cards} kartu jadi berstatus dibayar dan tidak bisa masuk gajian lain.
            </li>
            <li>Cicilan kasbon tercatat di buku kasbon masing-masing penjahit.</li>
            <li>Rekening penjahit disimpan sebagai daftar transfer.</li>
            <li>Masih bisa dibuka lagi selama belum ada yang ditandai dibayar.</li>
          </ul>
          <p className="font-semibold">
            Total transfer {formatRupiah(overview.totals.transfer)} untuk {overview.totals.tailors}{' '}
            penjahit.
          </p>
          {lock.error && !warnings && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(lock.error)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="button" size="lg" disabled={lock.isPending} onClick={() => save(false)}>
              {lock.isPending ? 'Mengunci…' : 'Kunci gajian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmWarningsDialog
        warnings={isConfirming ? warnings : null}
        isPending={lock.isPending}
        onCancel={() => {
          setIsConfirming(false)
          onClose()
        }}
        onConfirm={() => save(true)}
      />
    </>
  )
}

export function UnlockDialog({ payOn, onClose }: { payOn: string; onClose: () => void }) {
  const unlock = useUnlockPayroll()
  const [reason, setReason] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buka kunci gajian?</DialogTitle>
          <DialogDescription>
            Kartu kembali ke status disetor, cicilan kasbon dari gajian ini dihapus, dan tanda
            dibayar dibatalkan, supaya rekap, kasbon, dan kartu bisa diperbaiki atau dihapus.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">Alasan</Label>
          <Textarea
            id="unlock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. ada kartu yang lupa di-scan"
          />
          {unlock.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(unlock.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={reason.trim() === '' || unlock.isPending}
            onClick={() =>
              unlock.mutate(
                { payOn, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Gajian dibuka lagi')
                    onClose()
                  },
                },
              )
            }
          >
            {unlock.isPending ? 'Membuka…' : 'Buka kunci'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SAMPLE_PRICES = { high: 100_000, low: 50_000 } as const

function CountField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        className="h-12 font-mono text-lg"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="0"
      />
    </div>
  )
}

/** Samples sewn this week, by price. Saving replaces the week's sample count for this tailor. */
export function SamplesDialog({
  payOn,
  tailor,
  initial,
  onClose,
}: {
  payOn: string
  tailor: { id: string; code: string; name: string }
  initial: { high: number; low: number }
  onClose: () => void
}) {
  const setSamples = useSetSamples()
  const [high, setHigh] = useState(initial.high ? String(initial.high) : '')
  const [low, setLow] = useState(initial.low ? String(initial.low) : '')
  const highCount = Number(high || 0)
  const lowCount = Number(low || 0)
  const total = highCount * SAMPLE_PRICES.high + lowCount * SAMPLE_PRICES.low

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSamples.mutate(
      { payOn, tailorId: tailor.id, high: highCount, low: lowCount },
      {
        onSuccess: () => {
          toast.success(`Sampel ${tailor.name} · ${formatRupiah(total)}`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sampel · {tailor.name}</DialogTitle>
          <DialogDescription>
            Jumlah sampel yang dikerjakan minggu ini (gajian {formatPayDay(payOn)}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CountField id="sample-high" label="Sampel 100rb" value={high} onChange={setHigh} />
            <CountField id="sample-low" label="Sampel 50rb" value={low} onChange={setLow} />
          </div>
          <p className="flex items-center justify-between rounded-2xl border bg-background/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total sampel</span>
            <span className="font-mono font-semibold tabular-nums">{formatRupiah(total)}</span>
          </p>
          {setSamples.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(setSamples.error)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={setSamples.isPending}>
              {setSamples.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
