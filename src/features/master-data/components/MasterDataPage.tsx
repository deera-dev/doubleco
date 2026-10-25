import { Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useRemoveMasterData,
  useSaveFabric,
  useSaveSize,
} from '@/features/master-data/api/mutations'
import { useMasterData } from '@/features/master-data/api/queries'
import type { Fabric, FabricColor, MasterData, Size } from '@/features/master-data/api/schema'
import { NamedItemDialog } from '@/features/master-data/components/NamedItemDialog'
import {
  FabricsPanel,
  ProductsPanel,
  SizesPanel,
  WageRatesPanel,
} from '@/features/master-data/components/Panels'
import { ProductDialog } from '@/features/master-data/components/ProductDialog'
import { WageRateDialog } from '@/features/master-data/components/WageRateDialog'
import { type MasterDataTab, useMasterDataUiStore } from '@/features/master-data/store'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { toAppError } from '@/shared/types/errors'

const addLabels: Record<MasterDataTab, string> = {
  products: 'Produk',
  fabrics: 'Bahan',
  sizes: 'Ukuran',
  wages: 'Tarif',
}

function exportTab(tab: MasterDataTab, data: MasterData) {
  const date = todayIsoDate()
  switch (tab) {
    case 'products':
      return downloadCsv(`produk-${date}.csv`, data.products, [
        { header: 'Kode produk', value: (row) => row.code },
        { header: 'Nama', value: (row) => row.name },
        { header: 'Kategori', value: (row) => row.category },
        { header: 'Aktif', value: (row) => (row.isActive ? 'Ya' : 'Tidak') },
      ])
    case 'fabrics':
      return downloadCsv(
        `bahan-warna-${date}.csv`,
        data.fabrics.flatMap((fabric): { fabric: Fabric; color: FabricColor | null }[] =>
          fabric.colors.length === 0
            ? [{ fabric, color: null }]
            : fabric.colors.map((color) => ({ fabric, color })),
        ),
        [
          { header: 'Bahan', value: (row) => row.fabric.name },
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

  return (
    <NamedItemDialog
      title={fabric ? `Ubah ${fabric.name}` : 'Tambah bahan'}
      description="Warna diatur langsung di kartu bahan."
      nameLabel="Nama bahan"
      placeholder="BLACK SWAN"
      initialName={fabric?.name ?? ''}
      initialActive={fabric?.isActive ?? true}
      canDelete={fabric !== null}
      isSaving={saveFabric.isPending}
      isDeleting={remove.isPending}
      saveError={saveFabric.error}
      onClose={closeEditor}
      onSave={(values, onDuplicate) =>
        saveFabric.mutate(
          { id: fabric?.id ?? null, ...values },
          {
            onSuccess: () => {
              toast.success(fabric ? 'Bahan diperbarui' : `${values.name} ditambahkan`)
              closeEditor()
            },
            onError: (error) =>
              error.kind === 'business' && error.code === 'DUPLICATE' && onDuplicate(),
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
      return <ProductDialog product={editor.product} wageRates={data.wageRates} />
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

export function MasterDataPage() {
  const tab = useMasterDataUiStore((state) => state.tab)
  const setTab = useMasterDataUiStore((state) => state.setTab)
  const openEditor = useMasterDataUiStore((state) => state.openEditor)
  const masterData = useMasterData()
  const data = masterData.data

  const add = () => {
    switch (tab) {
      case 'products':
        return openEditor({ kind: 'product', product: null })
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
        description="Produk, bahan & warna, ukuran, dan tarif upah. Diisi sekali, dipakai di semua kartu."
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
          { value: 'fabrics', label: 'Bahan & warna', count: data?.fabrics.length },
          { value: 'sizes', label: 'Ukuran', count: data?.sizes.length },
          { value: 'wages', label: 'Tarif upah' },
        ]}
      />

      {masterData.isPending ? (
        <ListSkeleton />
      ) : masterData.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(masterData.error))}
        </p>
      ) : (
        <div key={tab} className="stagger-2 animate-rise">
          {tab === 'products' && <ProductsPanel data={masterData.data} />}
          {tab === 'fabrics' && <FabricsPanel data={masterData.data} />}
          {tab === 'sizes' && <SizesPanel data={masterData.data} />}
          {tab === 'wages' && <WageRatesPanel data={masterData.data} />}
        </div>
      )}

      {data && <Editors data={data} />}
    </div>
  )
}
