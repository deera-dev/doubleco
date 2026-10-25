import { Link } from '@tanstack/react-router'
import { ChevronRight, Download, Printer, Scissors, Search, Shirt } from 'lucide-react'
import { useCuttingBoard, useSewingCards } from '@/features/sewing-cards/api/queries'
import type { BoardWorkOrder, SewingCard } from '@/features/sewing-cards/api/schema'
import { CardDialogs } from '@/features/sewing-cards/components/CardDialogs'
import { CardRow } from '@/features/sewing-cards/components/CardRow'
import { cardPrintSearch, cardStatusMeta } from '@/features/sewing-cards/lib/status'
import { useSewingCardsUiStore } from '@/features/sewing-cards/store'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { type CsvColumn, downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { toAppError } from '@/shared/types/errors'

const cardColumns: CsvColumn<SewingCard>[] = [
  { header: 'Nomor kartu', value: (row) => row.number },
  { header: 'Status', value: (row) => cardStatusMeta[row.status].label },
  { header: 'Tanggal ambil', value: (row) => row.takenOn },
  { header: 'Kode penjahit', value: (row) => row.tailorCode },
  { header: 'Nama penjahit', value: (row) => row.tailorName },
  { header: 'Nomor WO', value: (row) => row.workOrderNumber },
  { header: 'Kode produk', value: (row) => row.productCode },
  { header: 'Ukuran', value: (row) => row.sizeName },
  { header: 'Warna', value: (row) => row.colorName },
  { header: 'Jumlah', value: (row) => row.quantity },
  { header: 'Kategori', value: (row) => row.category },
  { header: 'Upah', value: (row) => row.wageAmount },
  { header: 'Tanggal setor', value: (row) => row.submittedOn },
]

function BoardRow({ workOrder, isReady }: { workOrder: BoardWorkOrder; isReady: boolean }) {
  return (
    <Link
      to="/work-order/$id"
      params={{ id: workOrder.id }}
      className="surface interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-surface-hover"
    >
      <span className="sheen-primary flex size-11 shrink-0 items-center justify-center rounded-xl font-semibold text-lg text-primary-foreground">
        {workOrder.category ?? '?'}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate font-medium font-mono text-sm">{workOrder.number}</span>
        <span className="block truncate text-muted-foreground text-xs">
          {formatWorkOrderDate(workOrder.orderedOn)} · potong {workOrder.cutterName}
          {isReady && workOrder.uncutItems > 0
            ? ` · ${workOrder.uncutItems} ukuran/warna belum dipotong`
            : ''}
        </span>
      </span>
      {isReady && (
        <span className="shrink-0 text-right">
          <span className="block font-mono font-semibold text-2xl tabular-nums leading-none">
            {workOrder.remaining}
          </span>
          <span className="text-subtle-foreground text-xs">pcs tanpa kartu</span>
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function ReadyPanel() {
  const board = useCuttingBoard()

  if (board.isPending) return <ListSkeleton />
  if (board.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {describeError(toAppError(board.error))}
      </p>
    )
  }

  const { readyToSplit, waitingForCut } = board.data
  if (readyToSplit.length === 0 && waitingForCut.length === 0) {
    return (
      <EmptyState
        icon={Scissors}
        title="Semua kartu sudah dicetak"
        description="WO muncul di sini setelah hasil potongnya diisi dan kartunya belum dibuat."
        action={
          <Button asChild>
            <Link to="/work-order">Buka Work Order</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {readyToSplit.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Siap dicetak
            </h2>
            <p className="text-muted-foreground text-sm">
              Buka WO-nya, lalu tekan “Buat & cetak kartu” di bagian Hasil potong.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {readyToSplit.map((workOrder) => (
              <li key={workOrder.id}>
                <BoardRow workOrder={workOrder} isReady />
              </li>
            ))}
          </ul>
        </section>
      )}
      {waitingForCut.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Menunggu hasil potong
          </h2>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {waitingForCut.map((workOrder) => (
              <li key={workOrder.id}>
                <BoardRow workOrder={workOrder} isReady={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function CardsPanel() {
  const status = useSewingCardsUiStore((state) => state.status)
  const setStatus = useSewingCardsUiStore((state) => state.setStatus)
  const search = useSewingCardsUiStore((state) => state.search)
  const setSearch = useSewingCardsUiStore((state) => state.setSearch)
  const selected = useSewingCardsUiStore((state) => state.selected)
  const toggleSelected = useSewingCardsUiStore((state) => state.toggleSelected)
  const setSelected = useSewingCardsUiStore((state) => state.setSelected)
  const cards = useSewingCards({ status, search, workOrderId: null })
  const visible = cards.data?.cards ?? []
  const printable = visible.filter((card) => card.status !== 'cancelled')
  const selectedVisible = selected.filter((number) =>
    printable.some((card) => card.number === number),
  )
  const allSelected = printable.length > 0 && selectedVisible.length === printable.length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedControl
          label="Status kartu"
          value={status}
          onChange={setStatus}
          className="w-fit max-w-full"
          options={[
            { value: 'taken', label: 'Di penjahit', count: cards.data?.summary.taken },
            { value: 'submitted', label: 'Disetor', count: cards.data?.summary.submitted },
            { value: 'paid', label: 'Dibayar', count: cards.data?.summary.paid },
            { value: 'all', label: 'Semua', count: cards.data?.summary.all },
          ]}
        />
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode / nama / nomor"
            aria-label="Cari kartu jahit"
            className="h-11 pl-10"
          />
        </div>
      </div>

      {cards.isPending ? (
        <ListSkeleton />
      ) : cards.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(cards.error))}
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="Belum ada kartu jahit"
          description={
            search
              ? 'Tidak ada kartu yang cocok dengan pencarian.'
              : 'Kartu muncul di sini setelah dibuat dari halaman WO.'
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(allSelected ? [] : printable.map((card) => card.number))}
              disabled={printable.length === 0}
            >
              {allSelected ? 'Batal pilih semua' : `Pilih semua (${printable.length})`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => downloadCsv(`kartu-jahit-${todayIsoDate()}.csv`, visible, cardColumns)}
            >
              <Download />
              Export
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {visible.map((card) => (
              <li key={card.id}>
                <CardRow
                  card={card}
                  isSelected={selected.includes(card.number)}
                  onToggle={
                    card.status === 'cancelled' ? undefined : () => toggleSelected(card.number)
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedVisible.length > 0 && (
        <div className="action-bar hide-with-keyboard sticky bottom-28 z-20 flex animate-rise items-center justify-between gap-3 rounded-2xl border p-3 lg:bottom-4">
          <p className="pl-1 text-muted-foreground text-sm">
            <span className="font-mono font-semibold text-foreground">
              {selectedVisible.length}
            </span>{' '}
            kartu dipilih
          </p>
          <Button asChild size="lg">
            <Link to="/cetak/kartu-jahit" search={cardPrintSearch(selectedVisible)}>
              <Printer />
              Cetak
            </Link>
          </Button>
        </div>
      )}
      <CardDialogs />
    </div>
  )
}

export function CuttingBoardPage() {
  const tab = useSewingCardsUiStore((state) => state.tab)
  const setTab = useSewingCardsUiStore((state) => state.setTab)
  const board = useCuttingBoard()
  const cards = useSewingCards({ status: 'taken', search: '', workOrderId: null })

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Produksi"
        title="Kartu Jahit"
        description="Kartu jahit 6×10 ber-QR: satu hasil potong (ukuran × warna) satu kartu. Pantau kartu yang masih di penjahit."
      />
      <SegmentedControl
        label="Bagian"
        value={tab}
        onChange={setTab}
        className="stagger-1 w-fit max-w-full animate-rise"
        options={[
          { value: 'ready', label: 'Siap dicetak', count: board.data?.readyToSplit.length },
          { value: 'cards', label: 'Daftar kartu', count: cards.data?.summary.taken },
        ]}
      />
      <div key={tab} className="stagger-2 animate-rise">
        {tab === 'ready' ? <ReadyPanel /> : <CardsPanel />}
      </div>
    </div>
  )
}
