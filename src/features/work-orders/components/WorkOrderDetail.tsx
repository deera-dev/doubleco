import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Ban, Pencil, Plus, Printer, ScanLine, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { usePrintMarks } from '@/features/print-settings/api'
import { PrintMarkBadge } from '@/features/print-settings/PrintMark'
import { WorkOrderCards } from '@/features/sewing-cards/components/WorkOrderCards'
import { useDeleteWorkOrder, useForceDeleteWorkOrder } from '@/features/work-orders/api/mutations'
import { useWorkOrder } from '@/features/work-orders/api/queries'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { CutResults } from '@/features/work-orders/components/CutResults'
import { SamplePhoto } from '@/features/work-orders/components/SamplePhoto'
import { WorkOrderDialogs } from '@/features/work-orders/components/WorkOrderDialogs'
import { formatWorkOrderDate, workOrderStatusMeta } from '@/features/work-orders/lib/status'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
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
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium text-sm">{children}</dd>
    </div>
  )
}

function Summary({ workOrder }: { workOrder: WorkOrder }) {
  const status = workOrderStatusMeta[workOrder.status]
  const cardPrints = usePrintMarks('work_order_card', [workOrder.id])
  const thpPrints = usePrintMarks('thp', [workOrder.id])
  return (
    <header className="animate-rise space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', status.className)}>
          {status.label}
        </span>
        <span className="text-muted-foreground text-sm">
          {formatWorkOrderDate(workOrder.orderedOn)}
        </span>
        <PrintMarkBadge label="Kartu WO dicetak" mark={cardPrints.data?.marks[workOrder.id]} />
        <PrintMarkBadge label="THP dicetak" mark={thpPrints.data?.marks[workOrder.id]} />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-mono font-semibold text-3xl tracking-tight">{workOrder.number}</h1>
          <p className="text-muted-foreground text-sm">
            {workOrder.productCode}
            {workOrder.productName ? ` · ${workOrder.productName}` : ''}
            {workOrder.category ? ` · kategori ${workOrder.category}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/cetak/wo/${workOrder.id}`} target="_blank" rel="noreferrer">
              <Printer />
              Cetak kartu WO
            </a>
          </Button>
          {workOrder.hasCards && (
            <Button asChild variant="outline">
              <Link to="/cetak/thp/$id" params={{ id: workOrder.id }}>
                <Printer />
                Cetak THP
              </Link>
            </Button>
          )}
          {workOrder.status !== 'cancelled' && (
            <Button asChild>
              <Link to="/work-order/$id/ubah" params={{ id: workOrder.id }}>
                <Pencil />
                Ubah
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function goToCutResults() {
  const section = document.getElementById('hasil-potong')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  section?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
}

/** Tells a first-time user what to do next on this WO, with the button that does it. */
function NextStep({ workOrder }: { workOrder: WorkOrder }) {
  const openDialog = useWorkOrdersUiStore((state) => state.openDialog)
  if (workOrder.status === 'cancelled' || workOrder.status === 'done') return null

  const { items } = workOrder
  const uncut = items.filter((item) => item.cutQuantity === null)
  const cardable = items.filter(
    (item) => item.cutQuantity !== null && item.cutQuantity > item.assignedQuantity,
  )
  const withTailor = items.some((item) => item.assignedQuantity > item.submittedQuantity)

  const usesColors = items.some((item) => item.colorId !== null)

  const step =
    !usesColors && !items.some((item) => (item.cutQuantity ?? 0) > 0)
      ? {
          title: 'Isi hasil potong',
          text: 'Kartu WO sudah bisa dicetak untuk tukang potong. Setelah dipotong, isi jumlah iketan per ukuran: satu iketan jadi satu kartu jahit.',
          action: (
            <Button type="button" onClick={goToCutResults}>
              <ArrowRight />
              Isi sekarang
            </Button>
          ),
        }
      : items.length === 0
        ? {
            title: 'Pilih warna yang dipotong',
            text: 'Kartu WO sudah bisa dicetak untuk tukang potong. Setelah dipotong, pilih warnanya lalu isi jumlah potongnya.',
            action: (
              <Button type="button" onClick={() => openDialog('add-items')}>
                <Plus />
                Pilih warna
              </Button>
            ),
          }
        : cardable.length > 0
          ? {
              title: `Buat & cetak ${cardable.length} kartu jahit`,
              text: 'Satu hasil potong (ukuran × warna) jadi satu kartu. Tombolnya ada di bagian Hasil potong.',
              action: (
                <Button type="button" onClick={goToCutResults}>
                  <ArrowRight />
                  Ke hasil potong
                </Button>
              ),
            }
          : uncut.length > 0
            ? {
                title: 'Isi hasil potong',
                text: `${uncut.length} ukuran/warna belum diisi jumlah potongnya.`,
                action: (
                  <Button type="button" onClick={goToCutResults}>
                    <ArrowRight />
                    Isi sekarang
                  </Button>
                ),
              }
            : withTailor
              ? {
                  title: 'Kartu ada di penjahit',
                  text: 'Scan kartunya saat disetor. Kartu yang disetor otomatis masuk gajian Sabtu.',
                  action: (
                    <Button asChild>
                      <Link to="/scan">
                        <ScanLine />
                        Buka Scan
                      </Link>
                    </Button>
                  ),
                }
              : null
  if (!step) return null

  return (
    <section className="stagger-1 flex animate-rise flex-col gap-3 rounded-3xl border border-brand-400/40 bg-brand-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium text-brand-100 text-xs uppercase tracking-wider">
          Langkah berikutnya
        </p>
        <p className="font-semibold">{step.title}</p>
        <p className="text-muted-foreground text-sm">{step.text}</p>
      </div>
      <div className="shrink-0">{step.action}</div>
    </section>
  )
}

function Details({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <section className="surface stagger-1 grid grid-cols-1 animate-rise content-start gap-5 rounded-3xl p-5 sm:grid-cols-2 sm:p-6 lg:col-span-2">
      <Fact label="Tukang potong">{workOrder.cutterName}</Fact>
      <Fact label="Bahan">
        {workOrder.fabricName}
        {workOrder.fabricCombination ? ` + ${workOrder.fabricCombination}` : ''}
      </Fact>
      <Fact label="Ukuran">{workOrder.sizes.join(', ')}</Fact>
      <Fact label="Kode pola">{workOrder.patternCode ?? '—'}</Fact>
      <div className="space-y-1 sm:col-span-2">
        <dt className="text-muted-foreground text-xs">Perubahan dari sampel</dt>
        <dd
          className={cn(
            'font-semibold text-sm',
            workOrder.changeStatus === 'changed' ? 'text-destructive' : 'text-brand-200',
          )}
        >
          {workOrder.changeStatus === 'changed'
            ? 'ADA PERUBAHAN'
            : 'TIDAK ADA PERUBAHAN (IKUT SAMPEL)'}
        </dd>
        {workOrder.changeNotes && (
          <dd className="text-muted-foreground text-sm">{workOrder.changeNotes}</dd>
        )}
      </div>
      <div className="space-y-1 sm:col-span-2">
        <dt className="text-muted-foreground text-xs">Info lanjutan</dt>
        <dd className="text-sm">{workOrder.additionalInfo ?? '—'}</dd>
      </div>
    </section>
  )
}

function ForceDeleteDialog({ workOrder, onClose }: { workOrder: WorkOrder; onClose: () => void }) {
  const navigate = useNavigate()
  const forceDelete = useForceDeleteWorkOrder()
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const cardCount = workOrder.items.reduce((sum, item) => sum + item.cardCount, 0)
  const canDelete = reason.trim() !== '' && confirmText.trim().toUpperCase() === 'HAPUS'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sheet-above-keyboard">
        <DialogHeader>
          <DialogTitle>Hapus paksa {workOrder.number}?</DialogTitle>
          <DialogDescription>
            WO ini dihapus permanen bersama {cardCount} kartu jahit, hasil pemeriksaan, dan usulan
            potongannya. Kartu yang sudah disetor tapi belum dibayar ikut keluar dari gajian. Tidak
            bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="force-reason">Alasan</Label>
            <Textarea
              id="force-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Mis. WO dobel, salah input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="force-confirm">Ketik HAPUS untuk memastikan</Label>
            <Input
              id="force-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-12 font-mono uppercase"
            />
          </div>
          {forceDelete.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(forceDelete.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={!canDelete || forceDelete.isPending}
            onClick={() =>
              forceDelete.mutate(
                { id: workOrder.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(`${workOrder.number} dihapus`)
                    navigate({ to: '/work-order' })
                  },
                },
              )
            }
          >
            <Trash2 />
            {forceDelete.isPending ? 'Menghapus…' : 'Hapus paksa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DangerZone({ workOrder }: { workOrder: WorkOrder }) {
  const navigate = useNavigate()
  const openDialog = useWorkOrdersUiStore((state) => state.openDialog)
  const deleteWorkOrder = useDeleteWorkOrder()
  const [isForcing, setIsForcing] = useState(false)

  return (
    <section className="stagger-3 flex animate-rise flex-wrap justify-end gap-2">
      {workOrder.status !== 'cancelled' && workOrder.status !== 'done' && (
        <Button type="button" variant="ghost" size="lg" onClick={() => openDialog('cancel')}>
          <Ban />
          Batalkan WO
        </Button>
      )}
      {workOrder.hasCards && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="text-destructive hover:text-destructive"
          onClick={() => setIsForcing(true)}
        >
          <Trash2 />
          Hapus paksa
        </Button>
      )}
      {isForcing && <ForceDeleteDialog workOrder={workOrder} onClose={() => setIsForcing(false)} />}
      {!workOrder.hasCards && (
        <ConfirmDeleteButton
          label="Hapus WO"
          isPending={deleteWorkOrder.isPending}
          onConfirm={() =>
            deleteWorkOrder.mutate(
              { id: workOrder.id, reason: 'Dihapus dari halaman WO' },
              {
                onSuccess: () => {
                  toast.success(`${workOrder.number} dihapus`)
                  navigate({ to: '/work-order' })
                },
                onError: (error) => toast.error(describeError(error)),
              },
            )
          }
        />
      )}
    </section>
  )
}

export function WorkOrderDetail({ id }: { id: string }) {
  const workOrder = useWorkOrder(id)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/work-order">
          <ArrowLeft />
          Work Order
        </Link>
      </Button>
      {workOrder.isPending ? (
        <ListSkeleton rows={4} />
      ) : workOrder.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(workOrder.error))}
        </p>
      ) : (
        <>
          <Summary workOrder={workOrder.data} />
          <NextStep workOrder={workOrder.data} />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Details workOrder={workOrder.data} />
            <SamplePhoto workOrder={workOrder.data} />
          </div>
          <CutResults
            key={workOrder.data.items.map((item) => `${item.id}:${item.cutQuantity}`).join()}
            workOrder={workOrder.data}
          />
          <WorkOrderCards workOrderId={workOrder.data.id} />
          <DangerZone workOrder={workOrder.data} />
          <WorkOrderDialogs workOrder={workOrder.data} />
        </>
      )}
    </div>
  )
}
