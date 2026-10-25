import { TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { describeWarning, type ServerWarning } from '@/shared/lib/warnings'

interface ConfirmWarningsDialogProps {
  warnings: ServerWarning[] | null
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmWarningsDialog({
  warnings,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmWarningsDialogProps) {
  return (
    <Dialog open={warnings !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
            <TriangleAlert className="size-5" />
          </span>
          <DialogTitle>Periksa dulu sebelum menyimpan</DialogTitle>
          <DialogDescription>
            Kami menemukan data yang mirip. Pastikan ini bukan duplikat.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {warnings?.map((warning) => (
            <li
              key={JSON.stringify(warning)}
              className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm"
            >
              {describeWarning(warning)}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Periksa lagi
          </Button>
          <Button type="button" size="lg" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Menyimpan…' : 'Tetap simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
