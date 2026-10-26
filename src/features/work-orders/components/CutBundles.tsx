import { useNavigate } from '@tanstack/react-router'
import { Plus, Printer, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { useRecordBundles } from '@/features/sewing-cards/api/mutations'
import { cardPrintSearch } from '@/features/sewing-cards/lib/status'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { parseBundles } from '@/features/work-orders/lib/bundles'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { labelKey, normalizeLabel } from '@/shared/lib/labels'

interface SizeDraft {
  /** What is being typed: one or more quantities separated by spaces. */
  text: string
  bundles: number[]
}

const MAX_BUNDLES_PER_SIZE = 100
const emptyDraft: SizeDraft = { text: '', bundles: [] }

/** Added bundles plus whatever is still in the box, so nothing typed is lost on save. */
function bundlesOf(draft: SizeDraft): number[] {
  return [...draft.bundles, ...parseBundles(draft.text)]
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
  const typed = parseBundles(draft.text)
  const pieces = bundlesOf(draft).reduce((sum, value) => sum + value, 0)

  const add = (event?: FormEvent) => {
    event?.preventDefault()
    if (typed.length === 0) return
    onChange({
      text: '',
      bundles: [...draft.bundles, ...typed].slice(0, MAX_BUNDLES_PER_SIZE),
    })
  }

  return (
    <li className="space-y-3 rounded-2xl border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{size}</p>
        <div className="flex items-center gap-1">
          {done && done.cards > 0 && (
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

      {draft.bundles.length > 0 && (
        <ol className="flex flex-wrap gap-2">
          {draft.bundles.map((value, index) => (
            <li
              // Bundles are positional: the index is their identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              className="flex h-10 items-center gap-1 rounded-xl border border-border-strong bg-background/60 pr-1 pl-3"
            >
              <span className="text-subtle-foreground text-xs">{index + 1}.</span>
              <span className="font-mono font-semibold tabular-nums">{value}</span>
              <button
                type="button"
                aria-label={`Hapus iketan ${index + 1} ${size}`}
                onClick={() =>
                  onChange({ ...draft, bundles: draft.bundles.filter((_, at) => at !== index) })
                }
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={add} noValidate className="flex gap-2">
        <Input
          inputMode="numeric"
          enterKeyHint="done"
          value={draft.text}
          onChange={(event) =>
            onChange({ ...draft, text: event.target.value.replace(/[^0-9 ,]/g, '') })
          }
          placeholder={
            draft.bundles.length === 0
              ? 'Isi iketan 1, mis. 12'
              : `Isi iketan ${draft.bundles.length + 1}`
          }
          aria-label={`Isi iketan ${size}`}
          className="h-12 font-mono text-lg placeholder:font-sans placeholder:text-base"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-12 shrink-0"
          disabled={typed.length === 0}
        >
          <Plus />
          Iketan
        </Button>
      </form>
      <p className="flex justify-between text-muted-foreground text-xs">
        <span>Bisa sekaligus dengan spasi, mis. 12 9 11</span>
        <span className="font-mono font-semibold text-foreground">
          {bundlesOf(draft).length} iketan · {pieces} pcs
        </span>
      </p>
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
