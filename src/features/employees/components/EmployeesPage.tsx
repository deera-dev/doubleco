import { Download, Plus, Search, Timer, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useEmployees } from '@/features/employees/api/queries'
import type { Employee } from '@/features/employees/api/schema'
import { CutterDialog } from '@/features/employees/components/CutterDialog'
import { EmployeeRow } from '@/features/employees/components/EmployeeRow'
import { RetentionDialog } from '@/features/employees/components/RetentionDialog'
import { TailorDialog } from '@/features/employees/components/TailorDialog'
import { useEmployeesUiStore } from '@/features/employees/store'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Pagination, paginate, usePageFor } from '@/shared/components/Pagination'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { type CsvColumn, downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { toAppError } from '@/shared/types/errors'

const PAGE_SIZE = 20

const statusLabels: Record<Employee['status'], string> = {
  active: 'Aktif',
  inactive: 'Tidak aktif',
}

const exportColumns: CsvColumn<Employee>[] = [
  { header: 'Jenis', value: (row) => (row.type === 'tailor' ? 'Penjahit' : 'Tukang potong') },
  { header: 'Kode', value: (row) => row.code },
  { header: 'Nama', value: (row) => row.name },
  { header: 'Status', value: (row) => statusLabels[row.status] },
  { header: 'Terhapus otomatis', value: (row) => row.purgeOn },
  { header: 'No. HP', value: (row) => row.phone },
  { header: 'Bank/E-wallet', value: (row) => row.account?.provider ?? null },
  { header: 'No. rekening', value: (row) => (row.account ? `'${row.account.number}` : null) },
  { header: 'Atas nama', value: (row) => row.account?.holder ?? null },
  { header: 'Sisa kasbon', value: (row) => row.advanceBalance },
  { header: 'Catatan', value: (row) => row.notes },
]

function Editors() {
  const editor = useEmployeesUiStore((state) => state.editor)
  switch (editor.kind) {
    case 'tailor':
      return <TailorDialog employee={editor.employee} />
    case 'cutter':
      return <CutterDialog employee={editor.employee} />
    case 'retention':
      return <RetentionDialog days={editor.days} />
    case 'closed':
      return null
  }
}

export function EmployeesPage() {
  const status = useEmployeesUiStore((state) => state.status)
  const type = useEmployeesUiStore((state) => state.type)
  const search = useEmployeesUiStore((state) => state.search)
  const setStatus = useEmployeesUiStore((state) => state.setStatus)
  const setType = useEmployeesUiStore((state) => state.setType)
  const setSearch = useEmployeesUiStore((state) => state.setSearch)
  const openEditor = useEmployeesUiStore((state) => state.openEditor)
  const employees = useEmployees({ status, type, search })
  const summary = employees.data?.summary
  const [page, setPage] = usePageFor(`${status}|${type}|${search}`)

  const exportList = () => {
    const rows = employees.data?.employees ?? []
    if (rows.length === 0) {
      toast('Tidak ada data untuk diexport')
      return
    }
    downloadCsv(`karyawan-${status}-${todayIsoDate()}.csv`, rows, exportColumns)
  }

  const select = (employee: Employee) =>
    openEditor(
      employee.type === 'tailor' ? { kind: 'tailor', employee } : { kind: 'cutter', employee },
    )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Karyawan"
        description={
          summary
            ? `${summary.all} terdaftar · ${summary.active} aktif`
            : 'Penjahit dan tukang potong'
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!employees.data}
              onClick={() =>
                employees.data &&
                openEditor({ kind: 'retention', days: employees.data.retentionDays })
              }
            >
              <Timer />
              {employees.data
                ? `Hapus otomatis ${employees.data.retentionDays} hari`
                : 'Hapus otomatis'}
            </Button>
            <Button type="button" variant="outline" onClick={exportList}>
              <Download />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openEditor({ kind: 'cutter', employee: null })}
            >
              <Plus />
              Tukang potong
            </Button>
            <Button type="button" onClick={() => openEditor({ kind: 'tailor', employee: null })}>
              <Plus />
              Penjahit
            </Button>
          </>
        }
      />

      <div className="stagger-1 flex animate-rise flex-col gap-3 lg:flex-row lg:items-center">
        <SegmentedControl
          label="Status karyawan"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Aktif', count: summary?.active },
            { value: 'inactive', label: 'Tidak aktif', count: summary?.inactive },
            { value: 'all', label: 'Semua', count: summary?.all },
          ]}
        />
        <SegmentedControl
          label="Jenis karyawan"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'Semua' },
            { value: 'tailor', label: 'Penjahit' },
            { value: 'cutter', label: 'Tukang potong' },
          ]}
        />
        <div className="relative lg:ml-auto lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau kode"
            aria-label="Cari karyawan"
            className="h-11 pl-10"
          />
        </div>
      </div>

      {employees.isPending ? (
        <ListSkeleton />
      ) : employees.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(employees.error))}
        </p>
      ) : employees.data.employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Tidak ditemukan' : 'Belum ada karyawan di daftar ini'}
          description={
            search
              ? `Tidak ada karyawan dengan nama atau kode "${search}".`
              : 'Tambahkan penjahit atau tukang potong. Data lama dari Excel juga bisa diimpor nanti.'
          }
          action={
            !search && (
              <Button type="button" onClick={() => openEditor({ kind: 'tailor', employee: null })}>
                <Plus />
                Tambah penjahit
              </Button>
            )
          }
        />
      ) : (
        <ul className="stagger-2 grid animate-rise grid-cols-1 gap-2">
          {paginate(employees.data.employees, page, PAGE_SIZE).map((employee) => (
            <li key={employee.id}>
              <EmployeeRow employee={employee} onSelect={() => select(employee)} />
            </li>
          ))}
        </ul>
      )}
      {employees.data && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={employees.data.employees.length}
          onChange={setPage}
        />
      )}

      <Editors />
    </div>
  )
}
