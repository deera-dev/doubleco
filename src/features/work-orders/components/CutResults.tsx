import { useNavigate } from '@tanstack/react-router'
import { Plus, Printer, Scissors, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useIssueCards } from '@/features/sewing-cards/api/mutations'
import { cardPrintSearch } from '@/features/sewing-cards/lib/status'
import { useRecordCut, useRemoveWorkOrderItem } from '@/features/work-orders/api/mutations'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { CutBundles } from '@/features/work-orders/components/CutBundles'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { itemLabel } from '@/shared/lib/item-label'

/** Older WOs whose cut results were counted per size × colour. */
function ColorCutResults({ workOrder }: { workOrder: WorkOrder }) {
  const navigate = useNavigate()
  const recordCut = useRecordCut()
  const issueCards = useIssueCards()
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

  // One card per cut size × colour, holding every piece that has no card yet.
  const cardable = workOrder.items.filter(
    (item) => item.cutQuantity !== null && item.cutQuantity > item.assignedQuantity,
  )
  const cardPieces = cardable.reduce(
    (sum, item) => sum + (item.cutQuantity ?? 0) - item.assignedQuantity,
    0,
  )

  const issue = () =>
    issueCards.mutate(
      {
        takenOn: todayIsoDate(),
        cards: cardable.map((item) => ({
          workOrderItemId: item.id,
          quantity: (item.cutQuantity ?? 0) - item.assignedQuantity,
        })),
        confirmed: false,
        reason: null,
      },
      {
        onSuccess: ({ numbers }) => {
          toast.success(`${numbers.length} kartu jahit dibuat`)
          navigate({ to: '/cetak/kartu-jahit', search: cardPrintSearch(numbers) })
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )

  const save = () => {
    if (invalid) {
      toast.error(
        invalid.value < invalid.item.assignedQuantity
          ? `${itemLabel(invalid.item.sizeName, invalid.item.colorName)}: sudah dibagi ${invalid.item.assignedQuantity}, hasil potong tidak boleh lebih kecil`
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
    <section
      id="hasil-potong"
      className="surface stagger-2 animate-rise scroll-mt-24 space-y-4 rounded-3xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Hasil potong</h2>
          <p className="text-muted-foreground text-sm">
            Isi jumlah potongan per ukuran dan warna. Total {workOrder.totals.cut} potong.
          </p>
        </div>
        {!isClosed && workOrder.items.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => openDialog('add-items')}>
            <Plus />
            Tambah ukuran / warna
          </Button>
        )}
      </div>

      {workOrder.items.length === 0 && (
        <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
          <p className="font-medium">Warna belum dipilih</p>
          <p className="text-muted-foreground">
            {isClosed
              ? 'WO ini tidak punya rincian ukuran dan warna.'
              : 'Pilih warna yang dipotong, lalu isi jumlah potongnya di sini.'}
          </p>
          {!isClosed && (
            <Button type="button" className="mt-3" onClick={() => openDialog('add-items')}>
              <Plus />
              Pilih warna
            </Button>
          )}
        </div>
      )}

      {workOrder.items.length > 0 && (
        <ul className="divide-y rounded-2xl border">
          {workOrder.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{itemLabel(item.sizeName, item.colorName)}</p>
                <p className="text-muted-foreground text-xs">
                  {item.assignedQuantity > 0
                    ? `Di kartu ${item.assignedQuantity} · disetor ${item.submittedQuantity}`
                    : 'Belum ada kartu jahit'}
                </p>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                min={Math.max(1, item.assignedQuantity)}
                aria-label={`Hasil potong ${itemLabel(item.sizeName, item.colorName)}`}
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
                  aria-label={`Hapus ${itemLabel(item.sizeName, item.colorName)}`}
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
      )}

      {!isClosed && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {changed.length > 0 ? (
            <Button type="button" onClick={save} disabled={recordCut.isPending}>
              <Scissors />
              {recordCut.isPending ? 'Menyimpan…' : `Simpan ${changed.length} hasil potong`}
            </Button>
          ) : cardable.length > 0 ? (
            <>
              <p className="mr-auto text-muted-foreground text-sm">
                {cardable.length} hasil potong belum punya kartu · {cardPieces} pcs
              </p>
              <Button type="button" onClick={issue} disabled={issueCards.isPending}>
                <Printer />
                {issueCards.isPending ? 'Membuat…' : `Buat & cetak ${cardable.length} kartu`}
              </Button>
            </>
          ) : (
            <Button type="button" disabled>
              <Scissors />
              Simpan hasil potong
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/** Cut results are counted in iketan per size; WOs from before that keep their colour rows. */
export function CutResults({ workOrder }: { workOrder: WorkOrder }) {
  const usesColors = workOrder.items.some((item) => item.colorId !== null)
  return usesColors ? (
    <ColorCutResults workOrder={workOrder} />
  ) : (
    <CutBundles workOrder={workOrder} />
  )
}
