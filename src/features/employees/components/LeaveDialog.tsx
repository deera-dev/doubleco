import { useState } from 'react'
import { toast } from 'sonner'
import { useMarkTailorLeft } from '@/features/employees/api/mutations'
import type { Employee } from '@/features/employees/api/schema'
import { useEmployeesUiStore } from '@/features/employees/store'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
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
import { formatRupiah, todayIsoDate } from '@/shared/lib/format'
import { confirmationWarnings } from '@/shared/lib/warnings'

export function LeaveDialog({ employee }: { employee: Employee }) {
  const closeEditor = useEmployeesUiStore((state) => state.closeEditor)
  const markLeft = useMarkTailorLeft()
  const [leftOn, setLeftOn] = useState(todayIsoDate())
  const [notes, setNotes] = useState('')
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false)
  const warnings = confirmationWarnings(markLeft.error)

  const submit = (confirmed: boolean) =>
    markLeft.mutate(
      { id: employee.id, leftOn, notes: notes.trim() || null, confirmed },
      {
        onSuccess: ({ writtenOff }) => {
          toast.success(`${employee.name} ditandai keluar`, {
            description:
              writtenOff > 0
                ? `Sisa kasbon ${formatRupiah(writtenOff)} dicatat sebagai kerugian.`
                : undefined,
          })
          closeEditor()
        },
        onError: (error) => setIsAwaitingConfirmation(confirmationWarnings(error) !== null),
      },
    )

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai {employee.name} keluar</DialogTitle>
            <DialogDescription>
              Penjahit yang keluar tidak bisa diberi kartu jahit atau kasbon baru. Bisa diaktifkan
              kembali kapan saja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {employee.advanceBalance > 0 && (
              <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4">
                <p className="text-muted-foreground text-xs">Sisa kasbon</p>
                <p className="font-mono font-semibold text-2xl tabular-nums">
                  {formatRupiah(employee.advanceBalance)}
                </p>
                <p className="mt-1 text-muted-foreground text-sm">Akan dicatat sebagai kerugian.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="left-on">Tanggal keluar</Label>
              <Input
                id="left-on"
                type="date"
                value={leftOn}
                max={todayIsoDate()}
                onChange={(event) => setLeftOn(event.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="left-notes">Catatan (opsional)</Label>
              <Textarea
                id="left-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Mis. pindah kerja, pulang kampung"
              />
            </div>
            {markLeft.error && !warnings && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(markLeft.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => submit(false)}
              disabled={markLeft.isPending || leftOn === ''}
            >
              {markLeft.isPending ? 'Menyimpan…' : 'Tandai keluar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmWarningsDialog
        warnings={isAwaitingConfirmation ? warnings : null}
        isPending={markLeft.isPending}
        onCancel={() => setIsAwaitingConfirmation(false)}
        onConfirm={() => submit(true)}
      />
    </>
  )
}
