import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Scissors } from 'lucide-react'
import { useState } from 'react'
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
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { confirmationWarnings } from '@/shared/lib/warnings'
import { toAppError } from '@/shared/types/errors'

function SplitForm({ options }: { options: SplitOptions }) {
  const navigate = useNavigate()
  const issueCards = useIssueCards()
  const { workOrder, items } = options
  // One card per cut size × colour, holding everything that is still unassigned.
  const ready = items.filter((item) => item.cut !== null && (item.remaining ?? 0) > 0)
  const carded = items.filter((item) => item.cut !== null && (item.remaining ?? 0) === 0)
  const uncut = items.filter((item) => item.cut === null)
  const [selected, setSelected] = useState(() => ready.map((item) => item.id))
  const [takenOn, setTakenOn] = useState(options.today)
  const [isConfirming, setIsConfirming] = useState(false)
  const chosen = ready.filter((item) => selected.includes(item.id))
  const totalPieces = chosen.reduce((sum, item) => sum + (item.remaining ?? 0), 0)
  const warnings = confirmationWarnings(issueCards.error)

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  const submit = (confirmed: boolean) =>
    issueCards.mutate(
      {
        takenOn,
        cards: chosen.map((item) => ({ workOrderItemId: item.id, quantity: item.remaining ?? 0 })),
        confirmed,
        reason: confirmed ? 'Dikonfirmasi saat membuat kartu' : null,
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

  return (
    <div className="space-y-4">
      <section className="surface stagger-1 animate-rise space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Kartu yang akan dibuat
            </h2>
            <p className="text-muted-foreground text-sm">
              Satu hasil potong (ukuran × warna) = satu kartu jahit. Nama dan kode penjahit ditulis
              tangan, lalu dicatat saat kartu disetor.
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
        {ready.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
            Semua hasil potong sudah punya kartu.
          </p>
        ) : (
          <ul className="space-y-2">
            {ready.map((item) => {
              const isSelected = selected.includes(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      'interactive flex w-full items-center gap-3 rounded-2xl border bg-background/40 p-3 text-left',
                      isSelected ? 'border-brand-400/60 bg-brand-500/10' : 'opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-lg border border-border-strong',
                        isSelected && 'sheen-primary border-transparent text-primary-foreground',
                      )}
                    >
                      {isSelected && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">
                        {item.sizeName} · {item.colorName}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {item.assigned > 0
                          ? `sisa dari ${item.cut} (${item.assigned} sudah di kartu lain)`
                          : 'hasil potong'}
                        {workOrder.wageRate
                          ? ` · upah ${formatRupiah((item.remaining ?? 0) * workOrder.wageRate)}`
                          : ''}
                      </span>
                    </span>
                    <span className="font-mono font-semibold text-lg tabular-nums">
                      {item.remaining}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {(carded.length > 0 || uncut.length > 0) && (
          <p className="text-muted-foreground text-xs">
            {[
              carded.length > 0 ? `${carded.length} sudah punya kartu` : null,
              uncut.length > 0 ? `${uncut.length} belum diisi hasil potongnya` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
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
            {chosen.length}
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
          disabled={chosen.length === 0 || issueCards.isPending}
          onClick={() => submit(false)}
        >
          {issueCards.isPending
            ? 'Membuat…'
            : `Buat & cetak${chosen.length > 0 ? ` ${chosen.length}` : ''} kartu`}
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
