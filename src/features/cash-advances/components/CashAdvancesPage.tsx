import { Link } from '@tanstack/react-router'
import { ChevronRight, HandCoins, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useCashAdvanceOverview } from '@/features/cash-advances/api/queries'
import { EntryDialog, type EntryEditor } from '@/features/cash-advances/components/EntryDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { labelKey } from '@/shared/lib/labels'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

type Filter = 'owing' | 'all'

export function CashAdvancesPage() {
  const overview = useCashAdvanceOverview()
  const [filter, setFilter] = useState<Filter>('owing')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EntryEditor | null>(null)
  const tailors = overview.data?.tailors ?? []
  const owing = tailors.filter((tailor) => tailor.balance > 0)
  const needle = labelKey(search)
  const visible = (filter === 'owing' ? owing : tailors).filter(
    (tailor) =>
      needle === '' || labelKey(tailor.code) === needle || labelKey(tailor.name).includes(needle),
  )

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Keuangan"
        title="Kasbon"
        description="Pinjaman penjahit, cicilan dari gaji Sabtu, dan sisanya."
        actions={
          <Button type="button" onClick={() => setEditor({ kind: 'advance', tailor: null })}>
            <Plus />
            Kasbon baru
          </Button>
        }
      />

      <section className="stagger-1 grid animate-rise grid-cols-2 gap-3">
        <div className="surface rounded-3xl p-5">
          <p className="text-muted-foreground text-xs">Total sisa kasbon</p>
          <p className="font-mono font-semibold text-2xl tabular-nums">
            {overview.data ? formatRupiah(overview.data.totalBalance) : '—'}
          </p>
        </div>
        <div className="surface rounded-3xl p-5">
          <p className="text-muted-foreground text-xs">Penjahit punya kasbon</p>
          <p className="font-mono font-semibold text-2xl tabular-nums">
            {overview.data ? owing.length : '—'}
          </p>
        </div>
      </section>

      <div className="stagger-2 flex animate-rise flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedControl
          label="Tampilkan"
          value={filter}
          onChange={setFilter}
          className="w-fit max-w-full"
          options={[
            { value: 'owing', label: 'Masih ada sisa', count: owing.length },
            { value: 'all', label: 'Semua penjahit', count: tailors.length },
          ]}
        />
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode / nama"
            aria-label="Cari penjahit"
            className="h-11 pl-10"
          />
        </div>
      </div>

      {overview.isPending ? (
        <ListSkeleton />
      ) : overview.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(overview.error))}
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={
            filter === 'owing' && needle === '' ? 'Tidak ada kasbon berjalan' : 'Tidak ditemukan'
          }
          description={
            filter === 'owing' && needle === ''
              ? 'Semua kasbon sudah lunas. Catat kasbon baru dengan tombol di atas.'
              : 'Coba kata kunci lain.'
          }
        />
      ) : (
        <ul className="stagger-3 grid animate-rise grid-cols-1 gap-2 lg:grid-cols-2">
          {visible.map((tailor) => (
            <li key={tailor.tailorId}>
              <Link
                to="/kasbon/$tailorId"
                params={{ tailorId: tailor.tailorId }}
                className="surface interactive group flex items-center gap-4 rounded-2xl p-4 hover:bg-surface-hover"
              >
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-border-strong bg-background/60">
                  <span className="font-mono font-semibold text-sm leading-none">
                    {tailor.code}
                  </span>
                  <span className="mt-0.5 text-subtle-foreground text-xs leading-none">kode</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">{tailor.name}</span>
                  <span className="block truncate text-muted-foreground text-xs">
                    pinjam {formatRupiah(tailor.borrowed)} · cicil {formatRupiah(tailor.repaid)}
                    {tailor.status !== 'active' ? ' · tidak aktif' : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono font-semibold tabular-nums',
                    tailor.balance > 0 ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  {formatRupiah(tailor.balance)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {editor && overview.data && (
        <EntryDialog
          editor={editor}
          tailors={tailors}
          today={overview.data.today}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}
