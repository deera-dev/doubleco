import { Download, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useRemoveMasterData,
  useSaveFabric,
  useSavePattern,
  useSaveSize,
} from '@/features/master-data/api/mutations'
import { useMasterData } from '@/features/master-data/api/queries'
import type {
  Fabric,
  FabricColor,
  FabricKind,
  FabricSeries,
  MasterData,
  Pattern,
  Size,
} from '@/features/master-data/api/schema'
import { NamedItemDialog } from '@/features/master-data/components/NamedItemDialog'
import {
  FabricsPanel,
  PatternsPanel,
  ProductsPanel,
  SizesPanel,
  WageRatesPanel,
} from '@/features/master-data/components/Panels'
import { ProductDialog } from '@/features/master-data/components/ProductDialog'
import { WageRateDialog } from '@/features/master-data/components/WageRateDialog'
import { type MasterDataTab, useMasterDataUiStore } from '@/features/master-data/store'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Pagination, paginate, usePageFor } from '@/shared/components/Pagination'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { labelKey } from '@/shared/lib/labels'
import { toAppError } from '@/shared/types/errors'

const addLabels: Record<MasterDataTab, string> = {
  products: 'Produk',
  patterns: 'Pola',
  fabrics: 'Bahan',
  sizes: 'Ukuran',
  wages: 'Tarif',
}

const fabricKindLabel: Record<FabricKind, string> = { motif: 'Motif', plain: 'Polos' }

interface FabricExportRow {
  fabric: Fabric
  series: FabricSeries | null
  color: FabricColor | null
}

function exportTab(tab: MasterDataTab, data: MasterData) {
  const date = todayIsoDate()
  switch (tab) {
    case 'products':
      return downloadCsv(`produk-${date}.csv`, data.products, [
        { header: 'Kode produk', value: (row) => row.code },
        { header: 'Nama', value: (row) => row.name },
        { header: 'Kategori', value: (row) => row.category },
        {
          header: 'Kode pola bawaan',
          value: (row) =>
            data.patterns.find((pattern) => pattern.id === row.defaultPatternId)?.code ?? null,
        },
        { header: 'Aktif', value: (row) => (row.isActive ? 'Ya' : 'Tidak') },
      ])
    case 'patterns':
      return downloadCsv(`kode-pola-${date}.csv`, data.patterns, [
        { header: 'Kode pola', value: (row) => row.code },
        { header: 'Aktif', value: (row) => (row.isActive ? 'Ya' : 'Tidak') },
      ])
    case 'fabrics':
      return downloadCsv(
        `bahan-warna-${date}.csv`,
        data.fabrics.flatMap((fabric): FabricExportRow[] =>
          fabric.series.length === 0
            ? [{ fabric, series: null, color: null }]
            : fabric.series.flatMap((series): FabricExportRow[] =>
                series.colors.length === 0
                  ? [{ fabric, series, color: null }]
                  : series.colors.map((color) => ({ fabric, series, color })),
              ),
        ),
        [
          { header: 'Bahan', value: (row) => row.fabric.name },
          { header: 'Kode bahan', value: (row) => row.fabric.code },
          { header: 'Jenis', value: (row) => fabricKindLabel[row.fabric.kind] },
          { header: 'Seri', value: (row) => row.series?.name ?? null },
          { header: 'Warna', value: (row) => row.color?.name ?? null },
          { header: 'Bahan aktif', value: (row) => (row.fabric.isActive ? 'Ya' : 'Tidak') },
        ],
      )
    case 'sizes':
      return downloadCsv(`ukuran-${date}.csv`, data.sizes, [
        { header: 'Urutan', value: (row) => row.sortOrder },
        { header: 'Ukuran', value: (row) => row.name },
        { header: 'Aktif', value: (row) => (row.isActive ? 'Ya' : 'Tidak') },
      ])
    case 'wages':
      return downloadCsv(
        `tarif-upah-${date}.csv`,
        data.wageRates.flatMap((group) =>
          group.history.map((rate) => ({ category: group.category, rate })),
        ),
        [
          { header: 'Kategori', value: (row) => row.category },
          { header: 'Upah per potong', value: (row) => row.rate.amount },
          { header: 'Berlaku mulai', value: (row) => row.rate.effectiveFrom },
        ],
      )
  }
}

function FabricEditor({ fabric }: { fabric: Fabric | null }) {
  const closeEditor = useMasterDataUiStore((state) => state.closeEditor)
  const saveFabric = useSaveFabric()
  const remove = useRemoveMasterData()
  const [kind, setKind] = useState<FabricKind>(fabric?.kind ?? 'motif')
  const [code, setCode] = useState(fabric?.code ?? '')

  return (
    <NamedItemDialog
      title={fabric ? `Ubah ${fabric.name}` : 'Tambah bahan'}
      description="Seri dan warna diatur langsung di kartu bahan."
      nameLabel="Nama bahan"
      placeholder="BLACK SWAN"
      initialName={fabric?.name ?? ''}
      initialActive={fabric?.isActive ?? true}
      canDelete={fabric !== null}
      isSaving={saveFabric.isPending}
      isDeleting={remove.isPending}
      saveError={saveFabric.error}
      onClose={closeEditor}
      onSave={(values) =>
        saveFabric.mutate(
          { id: fabric?.id ?? null, kind, code: code.trim().toUpperCase() || null, ...values },
          {
            onSuccess: () => {
              toast.success(fabric ? 'Bahan diperbarui' : `${values.name} ditambahkan`)
              closeEditor()
            },
            onError: (error) =>
              error.kind === 'business' &&
              error.code === 'DUPLICATE' &&
              toast.error('Nama atau kode bahan sudah dipakai bahan lain'),
          },
        )
      }
      onDelete={() =>
        fabric &&
        remove.mutate(
          { kind: 'fabric', id: fabric.id },
          {
            onSuccess: () => {
              toast.success(`${fabric.name} dihapus`)
              closeEditor()
            },
            onError: (error) => toast.error(describeError(error)),
          },
        )
      }
    >
      <div className="space-y-2">
        <Label htmlFor="fabric-code">Kode bahan</Label>
        <Input
          id="fabric-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Mis. BLS"
          autoCapitalize="characters"
          className="h-12 font-mono uppercase placeholder:normal-case"
        />
        <p className="text-muted-foreground text-xs">
          Dipakai di kode produk, mis. W-133 <span className="font-mono">BLS</span>.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Jenis bahan</Label>
        <SegmentedControl
          label="Jenis bahan"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'motif', label: 'Motif' },
            { value: 'plain', label: 'Polos (kombinasi)' },
          ]}
          className="w-fit max-w-full"
        />
      </div>
    </NamedItemDialog>
  )
}

function PatternEditor({ pattern }: { pattern: Pattern | null }) {
  const closeEditor = useMasterDataUiStore((state) => state.closeEditor)
  const savePattern = useSavePattern()
  const remove = useRemoveMasterData()

  return (
    <NamedItemDialog
      title={pattern ? `Ubah ${pattern.code}` : 'Tambah kode pola'}
      description="Kode pola dipilih saat membuat WO, jadi cukup diketik sekali di sini."
      nameLabel="Kode pola"
      placeholder="P-133"
      initialName={pattern?.code ?? ''}
      initialActive={pattern?.isActive ?? true}
      canDelete={pattern !== null}
      isSaving={savePattern.isPending}
      isDeleting={remove.isPending}
      saveError={savePattern.error}
      onClose={closeEditor}
      onSave={({ name, isActive }, onDuplicate) =>
        savePattern.mutate(
          { id: pattern?.id ?? null, code: name, isActive },
          {
            onSuccess: () => {
              toast.success(pattern ? 'Kode pola diperbarui' : `${name} ditambahkan`)
              closeEditor()
            },
            onError: (error) =>
              error.kind === 'business' && error.code === 'DUPLICATE' && onDuplicate(),
          },
        )
      }
      onDelete={() =>
        pattern &&
        remove.mutate(
          { kind: 'pattern', id: pattern.id },
          {
            onSuccess: () => {
              toast.success(`${pattern.code} dihapus`)
              closeEditor()
            },
            onError: (error) => toast.error(describeError(error)),
          },
        )
      }
    />
  )
}

function SizeEditor({ size, nextSortOrder }: { size: Size | null; nextSortOrder: number }) {
  const closeEditor = useMasterDataUiStore((state) => state.closeEditor)
  const saveSize = useSaveSize()
  const remove = useRemoveMasterData()

  return (
    <NamedItemDialog
      title={size ? `Ubah ${size.name}` : 'Tambah ukuran'}
      description="Urutan ukuran bisa diatur dengan tombol panah di daftar."
      nameLabel="Nama ukuran"
      placeholder="MIDI"
      initialName={size?.name ?? ''}
      initialActive={size?.isActive ?? true}
      canDelete={size !== null}
      isSaving={saveSize.isPending}
      isDeleting={remove.isPending}
      saveError={saveSize.error}
      onClose={closeEditor}
      onSave={(values, onDuplicate) =>
        saveSize.mutate(
          { id: size?.id ?? null, sortOrder: size?.sortOrder ?? nextSortOrder, ...values },
          {
            onSuccess: () => {
              toast.success(size ? 'Ukuran diperbarui' : `${values.name} ditambahkan`)
              closeEditor()
            },
            onError: (error) =>
              error.kind === 'business' && error.code === 'DUPLICATE' && onDuplicate(),
          },
        )
      }
      onDelete={() =>
        size &&
        remove.mutate(
          { kind: 'size', id: size.id },
          {
            onSuccess: () => {
              toast.success(`${size.name} dihapus`)
              closeEditor()
            },
            onError: (error) => toast.error(describeError(error)),
          },
        )
      }
    />
  )
}

function Editors({ data }: { data: MasterData }) {
  const editor = useMasterDataUiStore((state) => state.editor)
  switch (editor.kind) {
    case 'product':
      return (
        <ProductDialog
          product={editor.product}
          wageRates={data.wageRates}
          patterns={data.patterns}
        />
      )
    case 'pattern':
      return <PatternEditor pattern={editor.pattern} />
    case 'fabric':
      return <FabricEditor fabric={editor.fabric} />
    case 'size':
      return (
        <SizeEditor size={editor.size} nextSortOrder={(data.sizes.at(-1)?.sortOrder ?? -10) + 10} />
      )
    case 'wage_rate':
      return <WageRateDialog />
    case 'closed':
      return null
  }
}

const searchPlaceholders: Record<string, string> = {
  products: 'Cari kode / nama produk',
  patterns: 'Cari kode pola',
  fabrics: 'Cari bahan, kode, atau warna',
}

const PAGE_SIZE = { products: 30, patterns: 30, fabrics: 18 } as const

/** Filters the active tab by the search box and cuts it to one page; other tabs pass through. */
function searchTab(data: MasterData, tab: string, search: string, page: number) {
  const needle = labelKey(search)
  const matches = (...values: (string | null | undefined)[]) =>
    needle === '' || values.some((value) => value && labelKey(value).includes(needle))
  if (tab === 'products') {
    const items = data.products.filter((product) => matches(product.code, product.name))
    return {
      data: { ...data, products: paginate(items, page, PAGE_SIZE.products) },
      total: items.length,
      pageSize: PAGE_SIZE.products,
    }
  }
  if (tab === 'patterns') {
    const items = data.patterns.filter((pattern) => matches(pattern.code, pattern.notes))
    return {
      data: { ...data, patterns: paginate(items, page, PAGE_SIZE.patterns) },
      total: items.length,
      pageSize: PAGE_SIZE.patterns,
    }
  }
  if (tab === 'fabrics') {
    const items = data.fabrics.filter((fabric) =>
      matches(
        fabric.name,
        fabric.code,
        ...fabric.series.flatMap((series) => series.colors.map((color) => color.name)),
      ),
    )
    return {
      data: { ...data, fabrics: paginate(items, page, PAGE_SIZE.fabrics) },
      total: items.length,
      pageSize: PAGE_SIZE.fabrics,
    }
  }
  return null
}

export function MasterDataPage() {
  const tab = useMasterDataUiStore((state) => state.tab)
  const setTab = useMasterDataUiStore((state) => state.setTab)
  const openEditor = useMasterDataUiStore((state) => state.openEditor)
  const masterData = useMasterData()
  const data = masterData.data
  const [search, setSearch] = useState('')
  const [page, setPage] = usePageFor(`${tab}|${search}`)
  const isSearchable = tab === 'products' || tab === 'patterns' || tab === 'fabrics'
  const view = data ? searchTab(data, tab, search, page) : null

  const add = () => {
    switch (tab) {
      case 'products':
        return openEditor({ kind: 'product', product: null })
      case 'patterns':
        return openEditor({ kind: 'pattern', pattern: null })
      case 'fabrics':
        return openEditor({ kind: 'fabric', fabric: null })
      case 'sizes':
        return openEditor({ kind: 'size', size: null })
      case 'wages':
        return openEditor({ kind: 'wage_rate' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Master Data"
        description="Produk, kode pola, bahan & warna, ukuran, dan tarif upah. Diisi sekali di sini, lalu tinggal dipilih di WO dan kartu jahit."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => data && exportTab(tab, data)}
              disabled={!data}
            >
              <Download />
              Export
            </Button>
            <Button type="button" onClick={add}>
              <Plus />
              {addLabels[tab]}
            </Button>
          </>
        }
      />

      <SegmentedControl
        label="Jenis master data"
        value={tab}
        onChange={setTab}
        className="stagger-1 w-fit max-w-full animate-rise"
        options={[
          { value: 'products', label: 'Produk', count: data?.products.length },
          { value: 'patterns', label: 'Pola', count: data?.patterns.length },
          { value: 'fabrics', label: 'Bahan & warna', count: data?.fabrics.length },
          { value: 'sizes', label: 'Ukuran', count: data?.sizes.length },
          { value: 'wages', label: 'Tarif upah' },
        ]}
      />

      {isSearchable && (
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholders[tab]}
            aria-label="Cari master data"
            className="h-11 pl-10"
          />
        </div>
      )}

      {masterData.isPending ? (
        <ListSkeleton />
      ) : masterData.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(masterData.error))}
        </p>
      ) : (
        <div key={tab} className="stagger-2 animate-rise space-y-4">
          {view && view.total === 0 && search.trim() !== '' ? (
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description={`Tidak ada yang cocok dengan "${search.trim()}".`}
            />
          ) : (
            <>
              {tab === 'products' && <ProductsPanel data={view?.data ?? masterData.data} />}
              {tab === 'patterns' && <PatternsPanel data={view?.data ?? masterData.data} />}
              {tab === 'fabrics' && <FabricsPanel data={view?.data ?? masterData.data} />}
              {tab === 'sizes' && <SizesPanel data={masterData.data} />}
              {tab === 'wages' && <WageRatesPanel data={masterData.data} />}
            </>
          )}
          {view && isSearchable && (
            <Pagination
              page={page}
              pageSize={view.pageSize}
              total={view.total}
              onChange={setPage}
            />
          )}
        </div>
      )}

      {data && <Editors data={data} />}
    </div>
  )
}
