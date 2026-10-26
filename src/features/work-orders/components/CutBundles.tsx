import { useNavigate } from '@tanstack/react-router'
import { Plus, Printer, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { useRecordBundles } from '@/features/sewing-cards/api/mutations'
import { cardPrintSearch } from '@/features/sewing-cards/lib/status'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { labelKey, normalizeLabel } from '@/shared/lib/labels'

interface SizeDraft {
  count: string
  perBundle: string
  /** Bundle index → pieces, for the odd bundle that holds a different amount. */
  overrides: Record<number, string>
}

const MAX_BUNDLES_PER_SIZE = 50
const emptyDraft: SizeDraft = { count: '', perBundle: '', overrides: {} }
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 4)

function bundlesOf(draft: SizeDraft): number[] {
  const count = Math.min(Number(draft.count || 0), MAX_BUNDLES_PER_SIZE)
  const perBundle = Number(draft.perBundle || 0)
  return Array.from({ length: count }, (_, index) => Number(draft.overrides[index] ?? perBundle))
}

function SizeRow({
  size,
  draft,
  onChange,
  onRemove,
  done,
}: {
  size: string
  draft: SizeDraft
  onChange: (draft: SizeDraft) => void
  onRemove?: () => void
  done: { pieces: number; cards: number } | undefined
}) {
  const bundles = bundlesOf(draft)
  const pieces = bundles.reduce((sum, value) => sum + value, 0)

  return (
    <li className="space-y-3 rounded-2xl border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{size}</p>
        <div className="flex items-center gap-1">
          {done && (
            <span className="text-muted-foreground text-xs">
              sudah {done.cards} kartu · {done.pieces} pcs
            </span>
          )}
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Hapus ukuran ${size}`}
              onClick={onRemove}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-muted-foreground text-xs">Jumlah iketan</span>
          <Input
            inputMode="numeric"
            value={draft.count}
            onChange={(event) =>
              onChange({ ...draft, count: digitsOnly(event.target.value), overrides: {} })
            }
            placeholder="0"
            aria-label={`Jumlah iketan ${size}`}
            className="h-12 text-center font-mono text-lg"
          />
        </div>
        <span className="pb-3 font-mono text-muted-foreground">×</span>
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-muted-foreground text-xs">Isi per iketan</span>
          <Input
            inputMode="numeric"
            value={draft.perBundle}
            onChange={(event) =>
              onChange({ ...draft, perBundle: digitsOnly(event.target.value), overrides: {} })
            }
            placeholder="0"
            aria-label={`Isi per iketan ${size}`}
            className="h-12 text-center font-mono text-lg"
          />
        </div>
        <span className="pb-3 font-mono text-muted-foreground">=</span>
        <span className="w-16 shrink-0 pb-3 text-right font-mono font-semibold tabular-nums">
          {pieces} pcs
        </span>
      </div>
      {bundles.length > 0 && Number(draft.perBundle || 0) > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">
            Isi tiap iketan · ubah jika ada yang berbeda
          </p>
          <div className="flex flex-wrap gap-2">
            {bundles.map((value, index) => (
              <Input
                // Bundles are positional: the index is their identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={index}
                inputMode="numeric"
                value={draft.overrides[index] ?? String(value)}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    overrides: { ...draft.overrides, [index]: digitsOnly(event.target.value) },
                  })
                }
                aria-label={`Iketan ${index + 1} ${size}`}
                className="h-10 w-16 text-center font-mono"
              />
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

export function CutBundles({ workOrder }: { workOrder: WorkOrder }) {
  const navigate = useNavigate()
  const recordBundles = useRecordBundles()
  const isClosed = workOrder.status === 'cancelled' || workOrder.status === 'done'
  const done = new Map(
    workOrder.items.map((item) => [
      labelKey(item.sizeName),
      { pieces: item.cutQuantity ?? 0, cards: item.cardCount },
    ]),
  )
  const [sizes, setSizes] = useState(() => workOrder.sizes)
  const [drafts, setDrafts] = useState<Record<string, SizeDraft>>({})
  const [newSize, setNewSize] = useState('')
  const bundles = sizes.flatMap((size) =>
    bundlesOf(drafts[size] ?? emptyDraft).map((quantity) => ({ size, quantity })),
  )
  const totalPieces = bundles.reduce((sum, bundle) => sum + bundle.quantity, 0)
  const isValid = bundles.length > 0 && bundles.every((bundle) => bundle.quantity > 0)
  const hasCut = workOrder.items.some((item) => (item.cutQuantity ?? 0) > 0)

  const addSize = (event: FormEvent) => {
    event.preventDefault()
    const clean = normalizeLabel(newSize)
    if (labelKey(clean) === '' || sizes.some((size) => labelKey(size) === labelKey(clean))) return
    setSizes((current) => [...current, clean])
    setNewSize('')
  }

  const save = () =>
    recordBundles.mutate(
      { workOrderId: workOrder.id, takenOn: todayIsoDate(), bundles },
      {
        onSuccess: ({ numbers }) => {
          toast.success(`${numbers.length} kartu jahit dibuat`)
          setDrafts({})
          navigate({ to: '/cetak/kartu-jahit', search: cardPrintSearch(numbers) })
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <section
      id="hasil-potong"
      className="surface stagger-2 animate-rise scroll-mt-24 space-y-4 rounded-3xl p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="font-semibold">Hasil potong</h2>
        <p className="text-muted-foreground text-sm">
          {hasCut
            ? `Total ${workOrder.totals.cut} pcs sudah jadi kartu. Ada iketan susulan? Isi di bawah.`
            : 'Isi jumlah iketan per ukuran dari tukang potong. Satu iketan jadi satu kartu jahit.'}
        </p>
      </div>

      {isClosed ? (
        <p className="text-muted-foreground text-sm">WO ini sudah ditutup.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {sizes.map((size) => (
              <SizeRow
                key={size}
                size={size}
                draft={drafts[size] ?? emptyDraft}
                onChange={(draft) => setDrafts((current) => ({ ...current, [size]: draft }))}
                onRemove={
                  workOrder.sizes.includes(size)
                    ? undefined
                    : () => setSizes((current) => current.filter((value) => value !== size))
                }
                done={done.get(labelKey(size))}
              />
            ))}
          </ul>
          <form onSubmit={addSize} noValidate className="flex gap-2">
            <Input
              value={newSize}
              onChange={(event) => setNewSize(event.target.value)}
              placeholder="Ukuran lain, mis. XL"
              aria-label="Ukuran lain"
              autoCapitalize="characters"
              className="h-11 uppercase placeholder:normal-case"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-11 shrink-0"
              disabled={labelKey(newSize) === ''}
            >
              <Plus />
              Ukuran
            </Button>
          </form>
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              <span className="font-mono font-semibold text-foreground">{bundles.length}</span>{' '}
              iketan ·{' '}
              <span className="font-mono font-semibold text-foreground">{totalPieces}</span> pcs
            </p>
            <Button
              type="button"
              size="lg"
              disabled={!isValid || recordBundles.isPending}
              onClick={save}
            >
              <Printer />
              {recordBundles.isPending
                ? 'Menyimpan…'
                : bundles.length > 0
                  ? `Simpan & cetak ${bundles.length} kartu`
                  : 'Simpan & cetak kartu'}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
