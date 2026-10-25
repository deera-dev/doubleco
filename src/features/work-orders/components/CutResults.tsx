import { Plus, Scissors, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRecordCut, useRemoveWorkOrderItem } from '@/features/work-orders/api/mutations'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'

export function CutResults({ workOrder }: { workOrder: WorkOrder }) {
  const recordCut = useRecordCut()
  const removeItem = useRemoveWorkOrderItem()
  const openDialog = useWorkOrdersUiStore((state) => state.openDialog)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const isClosed = workOrder.status === 'cancelled' || workOrder.status === 'done'

  const changed = workOrder.items.flatMap((item) => {
    const draft = drafts[item.id]
    if (draft === undefined || draft.trim() === '') return []
    const value = Number(draft)
    return value !== item.cutQuantity ? [{ item, value }] : []
  })
  const invalid = changed.find(
    ({ item, value }) => !Number.isInteger(value) || value <= 0 || value < item.assignedQuantity,
  )

  const save = () => {
    if (invalid) {
      toast.error(
        invalid.value < invalid.item.assignedQuantity
          ? `${invalid.item.sizeName} ${invalid.item.colorName}: sudah dibagi ${invalid.item.assignedQuantity}, hasil potong tidak boleh lebih kecil`
          : 'Isi jumlah potong dengan angka bulat lebih dari 0',
      )
      return
    }
    recordCut.mutate(
      {
        items: changed.map(({ item, value }) => ({ workOrderItemId: item.id, cutQuantity: value })),
      },
      {
        onSuccess: () => {
          setDrafts({})
          toast.success('Hasil potong disimpan')
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )
  }

  return (
    <section className="surface stagger-2 animate-rise space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Hasil potong</h2>
          <p className="text-muted-foreground text-sm">
            Isi jumlah potongan per ukuran dan warna. Total {workOrder.totals.cut} potong.
          </p>
        </div>
        {!isClosed && (
          <Button type="button" variant="outline" size="sm" onClick={() => openDialog('add-items')}>
            <Plus />
            Ukuran / warna
          </Button>
        )}
      </div>

      <ul className="divide-y rounded-2xl border">
        {workOrder.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {item.sizeName} · {item.colorName}
              </p>
              <p className="text-muted-foreground text-xs">
                {item.assignedQuantity > 0
                  ? `Dibagi ${item.assignedQuantity} · disetor ${item.submittedQuantity}`
                  : 'Belum dibagi ke penjahit'}
              </p>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={Math.max(1, item.assignedQuantity)}
              aria-label={`Hasil potong ${item.sizeName} ${item.colorName}`}
              placeholder="0"
              disabled={isClosed}
              value={drafts[item.id] ?? item.cutQuantity?.toString() ?? ''}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
              }
              className="h-11 w-24 text-right font-mono tabular-nums"
            />
            {!isClosed && (
              <button
                type="button"
                aria-label={`Hapus ${item.sizeName} ${item.colorName}`}
                disabled={item.cardCount > 0 || removeItem.isPending}
                title={item.cardCount > 0 ? 'Sudah ada kartu jahit' : undefined}
                onClick={() =>
                  removeItem.mutate(
                    { itemId: item.id },
                    { onError: (error) => toast.error(describeError(error)) },
                  )
                }
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-destructive disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!isClosed && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={changed.length === 0 || recordCut.isPending}
          >
            <Scissors />
            {recordCut.isPending
              ? 'Menyimpan…'
              : changed.length > 0
                ? `Simpan ${changed.length} hasil potong`
                : 'Simpan hasil potong'}
          </Button>
        </div>
      )}
    </section>
  )
}
