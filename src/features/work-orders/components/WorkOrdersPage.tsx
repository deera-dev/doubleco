import { Link } from '@tanstack/react-router'
import { ChevronRight, ClipboardList, Download, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkOrders } from '@/features/work-orders/api/queries'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { formatWorkOrderDate, workOrderStatusMeta } from '@/features/work-orders/lib/status'
import { useWorkOrdersUiStore } from '@/features/work-orders/store'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { type CsvColumn, downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const exportColumns: CsvColumn<WorkOrder>[] = [
  { header: 'Nomor WO', value: (row) => row.number },
  { header: 'Tanggal', value: (row) => row.orderedOn },
  { header: 'Status', value: (row) => workOrderStatusMeta[row.status].label },
  { header: 'Kode produk', value: (row) => row.productCode },
  { header: 'Kategori', value: (row) => row.category },
  { header: 'Kode pola', value: (row) => row.patternCode },
  { header: 'Bahan', value: (row) => row.fabricName },
  { header: 'Kombinasi', value: (row) => row.fabricCombination },
  { header: 'Ukuran', value: (row) => row.sizes.join(', ') },
  { header: 'Warna', value: (row) => row.colors.join(', ') },
  { header: 'Tukang potong', value: (row) => row.cutterName },
  {
    header: 'Perubahan',
    value: (row) => (row.changeStatus === 'changed' ? row.changeNotes : 'Ikut sampel'),
  },
  { header: 'Hasil potong', value: (row) => row.totals.cut },
  { header: 'Dibagi', value: (row) => row.totals.assigned },
  { header: 'Disetor', value: (row) => row.totals.submitted },
]

function ProgressBar({ workOrder }: { workOrder: WorkOrder }) {
  const { cut, assigned, submitted } = workOrder.totals
  if (cut === 0) return null
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-border-strong" aria-hidden="true">
      <div className="sheen-primary h-full" style={{ width: `${(submitted / cut) * 100}%` }} />
      <div
        className="h-full bg-brand-400/40"
        style={{ width: `${((assigned - submitted) / cut) * 100}%` }}
      />
    </div>
  )
}

function WorkOrderRow({ workOrder }: { workOrder: WorkOrder }) {
  const status = workOrderStatusMeta[workOrder.status]
  return (
    <Link
      to="/work-order/$id"
      params={{ id: workOrder.id }}
      className={cn(
        'surface interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-surface-hover',
        workOrder.status === 'cancelled' && 'opacity-60',
      )}
    >
      <span className="sheen-primary flex size-11 shrink-0 items-center justify-center rounded-xl font-semibold text-lg text-primary-foreground">
        {workOrder.category ?? '?'}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium font-mono text-sm">{workOrder.number}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', status.className)}>
            {status.label}
          </span>
          {workOrder.changeStatus === 'changed' && (
            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
              Ada perubahan
            </span>
          )}
        </span>
        <span className="block truncate text-muted-foreground text-xs">
          {formatWorkOrderDate(workOrder.orderedOn)} · {workOrder.fabricName}
          {workOrder.fabricCombination ? `+${workOrder.fabricCombination}` : ''} ·{' '}
          {workOrder.sizes.join(', ')} · {workOrder.cutterName}
        </span>
        <ProgressBar workOrder={workOrder} />
      </span>
      <span className="hidden text-right sm:block">
        <span className="block font-mono font-semibold text-sm tabular-nums">
          {workOrder.totals.cut || '—'}
        </span>
        <span className="block text-subtle-foreground text-xs">potong</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function WorkOrdersPage() {
  const status = useWorkOrdersUiStore((state) => state.status)
  const search = useWorkOrdersUiStore((state) => state.search)
  const setStatus = useWorkOrdersUiStore((state) => state.setStatus)
  const setSearch = useWorkOrdersUiStore((state) => state.setSearch)
  const workOrders = useWorkOrders({ status, search })
  const summary = workOrders.data?.summary

  const exportList = () => {
    const rows = workOrders.data?.workOrders ?? []
    if (rows.length === 0) {
      toast('Tidak ada data untuk diexport')
      return
    }
    downloadCsv(`work-order-${status}-${todayIsoDate()}.csv`, rows, exportColumns)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Produksi"
        title="Work Order"
        description={
          summary
            ? `${summary.active} WO berjalan · ${summary.all} total`
            : 'Daftar WO dan progresnya'
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={exportList}>
              <Download />
              Export
            </Button>
            <Button asChild>
              <Link to="/work-order/baru">
                <Plus />
                WO baru
              </Link>
            </Button>
          </>
        }
      />

      <div className="stagger-1 flex animate-rise flex-col gap-3 lg:flex-row lg:items-center">
        <SegmentedControl
          label="Status WO"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Berjalan', count: summary?.active },
            { value: 'done', label: 'Selesai', count: summary?.done },
            { value: 'cancelled', label: 'Batal', count: summary?.cancelled },
            { value: 'all', label: 'Semua', count: summary?.all },
          ]}
        />
        <div className="relative lg:ml-auto lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nomor, produk, bahan"
            aria-label="Cari WO"
            className="h-11 pl-10"
          />
        </div>
      </div>

      {workOrders.isPending ? (
        <ListSkeleton />
      ) : workOrders.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(workOrders.error))}
        </p>
      ) : workOrders.data.workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search ? 'Tidak ditemukan' : 'Belum ada WO di daftar ini'}
          description={
            search
              ? `Tidak ada WO yang cocok dengan "${search}".`
              : 'Buat WO dari produk dan bahan di Master Data, lalu cetak kartunya untuk tukang potong.'
          }
          action={
            !search && (
              <Button asChild>
                <Link to="/work-order/baru">
                  <Plus />
                  WO baru
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="stagger-2 grid animate-rise grid-cols-1 gap-2">
          {workOrders.data.workOrders.map((workOrder) => (
            <li key={workOrder.id}>
              <WorkOrderRow workOrder={workOrder} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
