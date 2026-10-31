import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  useRecordAdvance,
  useRecordRepayment,
  useUpdateEntry,
} from '@/features/cash-advances/api/mutations'
import type { LedgerEntry, TailorBalance } from '@/features/cash-advances/api/schema'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
import { MoneyInput } from '@/shared/components/MoneyInput'
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
import { formatRupiah } from '@/shared/lib/format'
import { labelKey } from '@/shared/lib/labels'
import { confirmationWarnings } from '@/shared/lib/warnings'

export type EntryEditor =
  | { kind: 'advance' | 'repayment'; tailor: TailorBalance | null }
  | { kind: 'edit'; tailor: TailorBalance; entry: LedgerEntry }

const titles = { advance: 'Kasbon baru', repayment: 'Cicilan manual', edit: 'Ubah catatan kasbon' }

function tailorLabel(tailor: TailorBalance) {
  return `${tailor.code} · ${tailor.name}`
}

interface EntryDialogProps {
  editor: EntryEditor
  tailors: TailorBalance[]
  today: string
  onClose: () => void
}

export function EntryDialog({ editor, tailors, today, onClose }: EntryDialogProps) {
  const recordAdvance = useRecordAdvance()
  const recordRepayment = useRecordRepayment()
  const updateEntry = useUpdateEntry()
  const entry = editor.kind === 'edit' ? editor.entry : null
  const [tailorText, setTailorText] = useState(editor.tailor ? tailorLabel(editor.tailor) : '')
  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [entryOn, setEntryOn] = useState(entry?.entryOn ?? today)
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [reason, setReason] = useState('')
  const isAdvance = editor.kind === 'advance' || entry?.type === 'advance'
  const [given, setGiven] = useState(entry?.givenOn != null)
  const [isConfirming, setIsConfirming] = useState(false)
  const key = labelKey(tailorText)
  const tailor =
    editor.tailor ??
    tailors.find((candidate) => labelKey(tailorLabel(candidate)) === key) ??
    tailors.find((candidate) => labelKey(candidate.code) === key)
  const active =
    editor.kind === 'edit'
      ? updateEntry
      : editor.kind === 'advance'
        ? recordAdvance
        : recordRepayment
  const warnings = confirmationWarnings(active.error)
  const canSave = tailor !== undefined && amount !== null && amount > 0 && entryOn !== ''

  const done = (message: string) => {
    setIsConfirming(false)
    toast.success(message)
    onClose()
  }

  const save = (confirmed: boolean) => {
    if (!tailor || amount === null) return
    const onError = (error: Parameters<typeof confirmationWarnings>[0]) =>
      setIsConfirming(confirmationWarnings(error) !== null)
    if (editor.kind === 'edit') {
      updateEntry.mutate(
        {
          id: editor.entry.id,
          amount,
          entryOn,
          notes: notes.trim() || null,
          reason: reason.trim() || null,
          given: isAdvance ? given : null,
        },
        { onSuccess: () => done('Catatan kasbon diperbarui'), onError },
      )
      return
    }
    const mutation = editor.kind === 'advance' ? recordAdvance : recordRepayment
    mutation.mutate(
      {
        tailorId: tailor.tailorId,
        amount,
        entryOn,
        notes: notes.trim() || null,
        confirmed,
        reason: confirmed ? reason.trim() || 'Dikonfirmasi' : null,
        given: editor.kind === 'advance' ? given : false,
      },
      {
        onSuccess: () =>
          done(
            `${editor.kind === 'advance' ? 'Kasbon' : 'Cicilan'} ${formatRupiah(amount)} · ${tailor.name}`,
          ),
        onError,
      },
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canSave) save(false)
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sheet-above-keyboard">
          <DialogHeader>
            <DialogTitle>{titles[editor.kind]}</DialogTitle>
            <DialogDescription>
              {editor.kind === 'advance'
                ? 'Dibayarkan bersama gaji Sabtu (masuk ke transfer), lalu dicicil dari gaji berikutnya.'
                : editor.kind === 'repayment'
                  ? 'Untuk cicilan yang dibayar tunai di luar gajian. Cicilan dari gaji tercatat otomatis saat gajian dikunci.'
                  : 'Perubahan tercatat di riwayat.'}
            </DialogDescription>
          </DialogHeader>
          <form id="entry-form" onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-tailor">Penjahit</Label>
              {editor.tailor ? (
                <p className="rounded-xl border px-4 py-3 font-medium text-sm">
                  {tailorLabel(editor.tailor)}
                  <span className="ml-2 text-muted-foreground">
                    sisa {formatRupiah(editor.tailor.balance)}
                  </span>
                </p>
              ) : (
                <>
                  <Combobox
                    id="entry-tailor"
                    value={tailorText}
                    onValueChange={setTailorText}
                    placeholder="Ketik kode / nama"
                    options={tailors
                      .filter((candidate) => candidate.status === 'active')
                      .map((candidate) => ({
                        label: tailorLabel(candidate),
                        hint:
                          candidate.balance > 0
                            ? `sisa ${formatRupiah(candidate.balance)}`
                            : undefined,
                      }))}
                  />
                  {tailorText.trim() !== '' && !tailor && (
                    <p className="text-destructive text-xs">Penjahit tidak ditemukan.</p>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entry-amount">Jumlah</Label>
                <MoneyInput
                  id="entry-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-date">Tanggal</Label>
                <Input
                  id="entry-date"
                  type="date"
                  className="h-12"
                  value={entryOn}
                  onChange={(event) => setEntryOn(event.target.value)}
                />
              </div>
            </div>
            {isAdvance && (
              <Switch
                checked={given}
                onCheckedChange={setGiven}
                label="Sudah diberikan langsung"
                description={
                  given
                    ? 'Tunai atau sudah ditransfer: tidak ikut transfer gajian Sabtu, tetap dicicil.'
                    : 'Dibayar bersama gaji Sabtu (ikut transfer).'
                }
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="entry-notes">Catatan (opsional)</Label>
              <Textarea
                id="entry-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            {editor.kind === 'edit' && (
              <div className="space-y-2">
                <Label htmlFor="entry-reason">Alasan perubahan (opsional)</Label>
                <Input
                  id="entry-reason"
                  className="h-12"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}
            {active.error && !warnings && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(active.error)}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              form="entry-form"
              size="lg"
              disabled={!canSave || active.isPending}
            >
              {active.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmWarningsDialog
        warnings={isConfirming ? warnings : null}
        isPending={active.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => save(true)}
      />
    </>
  )
}
