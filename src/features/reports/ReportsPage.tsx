import { Link } from '@tanstack/react-router'
import { ClipboardList, NotebookTabs, Printer, Sheet } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { usePayrollTailors } from '@/features/payroll/api/queries'
import { formatPayDay, saturdayOf } from '@/features/payroll/lib/dates'
import { useWorkOrders } from '@/features/work-orders/api/queries'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { todayIsoDate } from '@/shared/lib/format'

function ReportCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="surface animate-rise space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border bg-background/40 [&_svg]:size-5">
          {icon}
        </span>
        <div className="space-y-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function DepositRecapCard() {
  const [day, setDay] = useState(todayIsoDate())
  const payOn = saturdayOf(day)
  return (
    <ReportCard
      icon={<Sheet />}
      title="Rekap setoran jahit"
      description="Per minggu: setoran harian S/M/L, upah, kasbon, cicilan, dan transfer tiap penjahit."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="recap-day">Minggu yang berisi tanggal</Label>
          <Input
            id="recap-day"
            type="date"
            value={day}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">Gajian {formatPayDay(payOn)}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/cetak/rekap-setoran" search={{ sabtu: payOn }}>
            <Printer />
            Buka & cetak
          </Link>
        </Button>
      </div>
    </ReportCard>
  )
}

function ThpCard() {
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const workOrders = useWorkOrders({
    status: 'all',
    search: debounced,
    fabricId: null,
    cutterId: null,
    category: null,
    page: 1,
  })
  const list = workOrders.data?.workOrders.slice(0, 6) ?? []
  return (
    <ReportCard
      icon={<ClipboardList />}
      title="THP (tanda hasil produksi)"
      description="Per WO, satu lembar per ukuran: siapa ambil kartu, jumlah, selesai, hasil OK/rusak, dan tanda tangan."
    >
      <div className="space-y-1.5">
        <Label htmlFor="thp-search">Cari WO</Label>
        <Input
          id="thp-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nomor WO / kode produk"
        />
      </div>
      <ul className="divide-y rounded-2xl border">
        {list.length === 0 ? (
          <li className="p-3 text-muted-foreground text-sm">
            {workOrders.isPending ? 'Memuat…' : 'Tidak ada WO.'}
          </li>
        ) : (
          list.map((workOrder) => (
            <li key={workOrder.id}>
              <Link
                to="/cetak/thp/$id"
                params={{ id: workOrder.id }}
                className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{workOrder.productCode}</span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {workOrder.number} · {formatWorkOrderDate(workOrder.orderedOn)} ·{' '}
                    {workOrder.cutterName}
                  </span>
                </span>
                <Printer className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))
        )}
      </ul>
    </ReportCard>
  )
}

function TailorBookCard() {
  const tailors = usePayrollTailors()
  const [tailorId, setTailorId] = useState('')
  return (
    <ReportCard
      icon={<NotebookTabs />}
      title="Rekap mingguan penjahit"
      description="Buku per penjahit: tiap Sabtu kasbon, upah, bayar, dan sisa kasbon, beserta rekeningnya."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="book-tailor-pick">Penjahit</Label>
          <NativeSelect
            id="book-tailor-pick"
            value={tailorId}
            onChange={(event) => setTailorId(event.target.value)}
          >
            <option value="">Semua penjahit (satu halaman per orang)</option>
            {tailors.data?.tailors.map((tailor) => (
              <option key={tailor.id} value={tailor.id}>
                {tailor.code} · {tailor.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button asChild size="lg">
          <Link to="/cetak/rekap-penjahit" search={{ penjahit: tailorId || undefined }}>
            <Printer />
            Buka & cetak
          </Link>
        </Button>
      </div>
    </ReportCard>
  )
}

export function ReportsPage() {
  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Keuangan & produksi"
        title="Laporan"
        description="Rekap yang bisa dicetak atau disimpan PDF, menggantikan Excel."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DepositRecapCard />
        <TailorBookCard />
        <ThpCard />
      </div>
    </div>
  )
}
