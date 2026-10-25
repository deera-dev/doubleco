import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Plus, Scissors, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { useIssueCards } from '@/features/sewing-cards/api/mutations'
import { useSplitOptions } from '@/features/sewing-cards/api/queries'
import type { SplitOptions } from '@/features/sewing-cards/api/schema'
import { cardPrintSearch } from '@/features/sewing-cards/lib/status'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { confirmationWarnings } from '@/shared/lib/warnings'
import { toAppError } from '@/shared/types/errors'

interface DraftCard {
  key: string
  workOrderItemId: string
  quantity: number
}

const MAX_CARDS_PER_ADD = 30

function SplitForm({ options }: { options: SplitOptions }) {
  const navigate = useNavigate()
  const issueCards = useIssueCards()
  const [drafts, setDrafts] = useState<DraftCard[]>([])
  const [takenOn, setTakenOn] = useState(options.today)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [cardCount, setCardCount] = useState('1')
  const [isConfirming, setIsConfirming] = useState(false)
  const { workOrder, items } = options

  const draftedFor = (id: string) =>
    drafts.filter((draft) => draft.workOrderItemId === id).reduce((sum, d) => sum + d.quantity, 0)
  const available = (id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    return item?.remaining == null ? 0 : item.remaining - draftedFor(id)
  }
  const selectedAvailable = itemId ? available(itemId) : 0
  const parsedQuantity = Number(quantity)
  const parsedCount = Number(cardCount)
  const requested = parsedQuantity * parsedCount
  const canAdd =
    itemId !== '' &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isInteger(parsedCount) &&
    parsedCount > 0 &&
    parsedCount <= MAX_CARDS_PER_ADD &&
    requested <= selectedAvailable
  const totalPieces = drafts.reduce((sum, draft) => sum + draft.quantity, 0)
  const warnings = confirmationWarnings(issueCards.error)

  const chooseItem = (id: string) => {
    setItemId(id)
    setQuantity(id ? String(available(id)) : '')
    setCardCount('1')
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!canAdd) return
    setDrafts((current) => [
      ...current,
      ...Array.from({ length: parsedCount }, () => ({
        key: crypto.randomUUID(),
        workOrderItemId: itemId,
        quantity: parsedQuantity,
      })),
    ])
    setItemId('')
    setQuantity('')
    setCardCount('1')
  }

  const submit = (confirmed: boolean) =>
    issueCards.mutate(
      {
        takenOn,
        cards: drafts.map(({ key: _key, ...card }) => card),
        confirmed,
        reason: confirmed ? 'Dikonfirmasi saat membagi kartu' : null,
      },
      {
        onSuccess: ({ numbers }) => {
          setIsConfirming(false)
          toast.success(`${numbers.length} kartu jahit dibuat`)
          navigate({ to: '/cetak/kartu-jahit', search: cardPrintSearch(numbers) })
        },
        onError: (error) => setIsConfirming(confirmationWarnings(error) !== null),
      },
    )

  const itemById = new Map(items.map((item) => [item.id, item]))

  return (
    <div className="space-y-4">
      <section className="surface stagger-1 animate-rise space-y-4 rounded-3xl p-5 sm:p-6">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Sisa hasil potong
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const left = available(item.id)
            const isCut = item.cut !== null
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!isCut || left === 0}
                  onClick={() => chooseItem(item.id)}
                  className={cn(
                    'surface interactive flex w-full flex-col gap-1 rounded-2xl p-3 text-left hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50',
                    itemId === item.id && 'border-brand-400/60 bg-brand-500/10',
                  )}
                >
                  <span className="truncate font-medium text-sm">
                    {item.sizeName} · {item.colorName}
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span className="font-mono font-semibold text-2xl tabular-nums">
                      {isCut ? left : '—'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {isCut ? `sisa dari ${item.cut}` : 'belum dipotong'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <form
        onSubmit={add}
        className="surface stagger-2 animate-rise space-y-4 rounded-3xl p-5 sm:p-6"
        noValidate
      >
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Tambah kartu
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:items-end">
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="split-item">Ukuran · warna</Label>
            <NativeSelect
              id="split-item"
              value={itemId}
              onChange={(event) => chooseItem(event.target.value)}
            >
              <option value="">Pilih</option>
              {items
                .filter((item) => available(item.id) > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sizeName} · {item.colorName} (sisa {available(item.id)})
                  </option>
                ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-quantity">Isi per kartu</Label>
            <Input
              id="split-quantity"
              inputMode="numeric"
              className="h-12 font-mono"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ''))}
              aria-invalid={quantity !== '' && !canAdd && itemId !== ''}
              placeholder="pcs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-count">Banyak kartu</Label>
            <Input
              id="split-count"
              inputMode="numeric"
              className="h-12 font-mono"
              value={cardCount}
              onChange={(event) => setCardCount(event.target.value.replace(/\D/g, ''))}
              aria-invalid={
                cardCount !== '' && (parsedCount < 1 || parsedCount > MAX_CARDS_PER_ADD)
              }
            />
          </div>
          <Button
            type="submit"
            size="lg"
            variant="outline"
            disabled={!canAdd}
            className="col-span-2 md:col-span-1"
          >
            <Plus />
            Tambah
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Nama dan kode penjahit ditulis tangan di kartu, lalu dicatat saat kartu disetor.
        </p>
        {itemId !== '' && requested > selectedAvailable && (
          <p className="text-destructive text-sm">
            {parsedCount > 1 ? `${parsedCount} × ${parsedQuantity} = ${requested} pcs, ` : ''}
            melebihi sisa ({selectedAvailable} pcs).
          </p>
        )}
      </form>

      <section className="surface stagger-3 animate-rise space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Kartu yang akan dibuat
            </h2>
            <p className="text-muted-foreground text-sm">
              Satu baris = satu kartu jahit (satu ukuran × satu warna).
            </p>
          </div>
          <div className="w-44 space-y-2">
            <Label htmlFor="split-date">Tanggal ambil</Label>
            <Input
              id="split-date"
              type="date"
              className="h-12"
              value={takenOn}
              onChange={(event) => setTakenOn(event.target.value)}
            />
          </div>
        </div>
        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
            Belum ada kartu. Pilih ukuran · warna dan isi per kartu di atas.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((draft, index) => {
              const item = itemById.get(draft.workOrderItemId)
              return (
                <li
                  key={draft.key}
                  className="flex animate-pop items-center gap-3 rounded-2xl border bg-background/40 p-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-strong font-mono font-semibold text-sm">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {item?.sizeName} · {item?.colorName}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      Kartu {index + 1}
                      {workOrder.wageRate
                        ? ` · upah ${formatRupiah(draft.quantity * workOrder.wageRate)}`
                        : ''}
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-lg tabular-nums">
                    {draft.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus kartu ${index + 1}`}
                    onClick={() =>
                      setDrafts((current) => current.filter((value) => value.key !== draft.key))
                    }
                  >
                    <X />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        {issueCards.error && !warnings && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(issueCards.error)}
          </p>
        )}
      </section>

      <div className="action-bar hide-with-keyboard sticky bottom-28 z-20 flex items-center justify-between gap-3 rounded-2xl border p-3 lg:bottom-4">
        <p className="pl-1 text-muted-foreground text-sm">
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {drafts.length}
          </span>{' '}
          kartu ·{' '}
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {totalPieces}
          </span>{' '}
          pcs
        </p>
        <Button
          type="button"
          size="lg"
          disabled={drafts.length === 0 || issueCards.isPending}
          onClick={() => submit(false)}
        >
          {issueCards.isPending ? 'Membuat…' : 'Buat & cetak kartu'}
        </Button>
      </div>

      <ConfirmWarningsDialog
        warnings={isConfirming ? warnings : null}
        isPending={issueCards.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => submit(true)}
      />
    </div>
  )
}

export function SplitPage({ workOrderId }: { workOrderId: string }) {
  const options = useSplitOptions(workOrderId)
  const workOrder = options.data?.workOrder

  return (
    <div className="space-y-6 pb-24">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/potong-bagi">
          <ArrowLeft />
          Potong & Bagi
        </Link>
      </Button>
      <PageHeader
        eyebrow="Bagi kartu jahit"
        title={workOrder?.number ?? 'Memuat…'}
        description={
          workOrder
            ? [
                workOrder.productCode,
                workOrder.category ? `kategori ${workOrder.category}` : null,
                workOrder.wageRate ? `${formatRupiah(workOrder.wageRate)}/pcs` : null,
                workOrder.fabricName,
                `potong ${workOrder.cutterName}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          workOrder && (
            <Button asChild variant="outline">
              <Link to="/work-order/$id" params={{ id: workOrder.id }}>
                Lihat WO
              </Link>
            </Button>
          )
        }
      />
      {options.isPending ? (
        <ListSkeleton rows={3} />
      ) : options.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(options.error))}
        </p>
      ) : options.data.items.every((item) => item.cut === null) ? (
        <EmptyState
          icon={Scissors}
          title="Hasil potong belum diisi"
          description="Isi jumlah hasil potong per ukuran × warna di halaman WO, lalu kembali ke sini."
          action={
            <Button asChild>
              <Link to="/work-order/$id" params={{ id: options.data.workOrder.id }}>
                Isi hasil potong
              </Link>
            </Button>
          }
        />
      ) : (
        <SplitForm options={options.data} />
      )}
    </div>
  )
}
