import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Ban, Pencil, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useDeleteWorkOrder } from '@/features/work-orders/api/mutations'
import { useWorkOrder } from '@/features/work-orders/api/queries'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { CutResults } from '@/features/work-orders/components/CutResults'
import { WorkOrderDialogs } from '@/features/work-orders/components/WorkOrderDialogs'
import { formatWorkOrderDate, workOrderStatusMeta } from '@/features/work-orders/lib/status'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { Button } from '@/shared/components/ui/button'
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
  return (
    <header className="animate-rise space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', status.className)}>
          {status.label}
        </span>
        <span className="text-muted-foreground text-sm">
          {formatWorkOrderDate(workOrder.orderedOn)}
        </span>
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

function Details({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <section className="surface stagger-1 animate-rise grid gap-5 rounded-3xl p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
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

function DangerZone({ workOrder }: { workOrder: WorkOrder }) {
  const navigate = useNavigate()
  const openDialog = useWorkOrdersUiStore((state) => state.openDialog)
  const deleteWorkOrder = useDeleteWorkOrder()

  if (workOrder.status === 'cancelled' && workOrder.hasCards) return null

  return (
    <section className="stagger-3 flex animate-rise flex-wrap justify-end gap-2">
      {workOrder.status !== 'cancelled' && workOrder.status !== 'done' && (
        <Button type="button" variant="ghost" size="lg" onClick={() => openDialog('cancel')}>
          <Ban />
          Batalkan WO
        </Button>
      )}
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
          <Details workOrder={workOrder.data} />
          <CutResults
            key={workOrder.data.items.map((item) => `${item.id}:${item.cutQuantity}`).join()}
            workOrder={workOrder.data}
          />
          <DangerZone workOrder={workOrder.data} />
          <WorkOrderDialogs workOrder={workOrder.data} />
        </>
      )}
    </div>
  )
}
