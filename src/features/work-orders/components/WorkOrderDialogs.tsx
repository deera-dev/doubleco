import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAddWorkOrderItems, useCancelWorkOrder } from '@/features/work-orders/api/mutations'
import { useWorkOrderFormOptions } from '@/features/work-orders/api/queries'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { ChipToggleGroup } from '@/shared/components/ChipToggleGroup'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'

function AddItemsDialog({ workOrder }: { workOrder: WorkOrder }) {
  const closeDialog = useWorkOrdersUiStore((state) => state.closeDialog)
  const options = useWorkOrderFormOptions()
  const addItems = useAddWorkOrderItems()
  const [sizeIds, setSizeIds] = useState(() => [
    ...new Set(workOrder.items.map((item) => item.sizeId)),
  ])
  const [colorIds, setColorIds] = useState(() => [
    ...new Set(workOrder.items.map((item) => item.colorId)),
  ])
  const colors =
    options.data?.fabrics
      .find((fabric) => fabric.id === workOrder.fabricId)
      ?.series.find((series) => series.id === workOrder.seriesId)?.colors ?? []

  const save = () =>
    addItems.mutate(
      { id: workOrder.id, sizeIds, colorIds },
      {
        onSuccess: () => {
          toast.success('Ukuran dan warna diperbarui')
          closeDialog()
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah ukuran / warna</DialogTitle>
          <DialogDescription>
            Kombinasi baru ditambahkan ke daftar hasil potong. Yang sudah ada tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Ukuran</Label>
            <ChipToggleGroup
              label="Ukuran"
              options={(options.data?.sizes ?? []).map((size) => ({
                id: size.id,
                label: size.name,
              }))}
              selected={sizeIds}
              onChange={setSizeIds}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Warna {workOrder.fabricName} · {workOrder.seriesName}
            </Label>
            <ChipToggleGroup
              label="Warna"
              options={colors.map((color) => ({ id: color.id, label: color.name }))}
              selected={colorIds}
              onChange={setColorIds}
            />
          </div>
          {addItems.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(addItems.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Batal
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={save}
            disabled={addItems.isPending || sizeIds.length === 0 || colorIds.length === 0}
          >
            {addItems.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ workOrder }: { workOrder: WorkOrder }) {
  const navigate = useNavigate()
  const closeDialog = useWorkOrdersUiStore((state) => state.closeDialog)
  const cancelWorkOrder = useCancelWorkOrder()
  const [reason, setReason] = useState('')

  const submit = () =>
    cancelWorkOrder.mutate(
      { id: workOrder.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`${workOrder.number} dibatalkan`)
          closeDialog()
          navigate({ to: '/work-order' })
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan {workOrder.number}?</DialogTitle>
          <DialogDescription>
            WO yang dibatalkan tetap tersimpan di daftar "Batal". Hanya bisa jika belum ada kartu
            jahit yang berjalan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Alasan</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. bahan belum datang"
          />
          {cancelWorkOrder.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(cancelWorkOrder.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Kembali
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={submit}
            disabled={cancelWorkOrder.isPending || reason.trim() === ''}
          >
            {cancelWorkOrder.isPending ? 'Memproses…' : 'Batalkan WO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WorkOrderDialogs({ workOrder }: { workOrder: WorkOrder }) {
  const dialog = useWorkOrdersUiStore((state) => state.dialog)
  if (dialog === 'add-items') return <AddItemsDialog workOrder={workOrder} />
  if (dialog === 'cancel') return <CancelDialog workOrder={workOrder} />
  return null
}
