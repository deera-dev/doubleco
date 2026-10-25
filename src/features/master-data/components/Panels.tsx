import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Package,
  Plus,
  Ruler,
  Shirt,
  SquareDashedKanban,
  X,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  useRemoveMasterData,
  useSaveColor,
  useSaveSeries,
  useSaveSize,
} from '@/features/master-data/api/mutations'
import type { Fabric, FabricSeries, MasterData, Size } from '@/features/master-data/api/schema'
import { useMasterDataUiStore } from '@/features/master-data/store'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { formatIsoDate, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import type { AppError } from '@/shared/types/errors'

function InactiveBadge() {
  return (
    <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-muted-foreground text-xs">
      Nonaktif
    </span>
  )
}

export function ProductsPanel({ data }: { data: MasterData }) {
  const openEditor = useMasterDataUiStore((state) => state.openEditor)
  const rateByCategory = new Map(
    data.wageRates.map((rate) => [rate.category, rate.current?.amount]),
  )

  if (data.products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Belum ada produk"
        description="Tambahkan kode produk seperti W-133 BLS beserta kategori kesulitannya."
        action={
          <Button type="button" onClick={() => openEditor({ kind: 'product', product: null })}>
            <Plus />
            Tambah produk
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {data.products.map((product) => {
        const rate = product.category ? rateByCategory.get(product.category) : undefined
        return (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => openEditor({ kind: 'product', product })}
              className={cn(
                'surface interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-surface-hover',
                !product.isActive && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl border font-semibold text-lg',
                  product.category
                    ? 'sheen-primary border-transparent text-primary-foreground'
                    : 'border-warning/40 border-dashed text-warning',
                )}
              >
                {product.category ?? '?'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium font-mono text-sm">{product.code}</span>
                <span
                  className={cn(
                    'block truncate text-muted-foreground text-xs',
                    !product.category && 'text-warning',
                  )}
                >
                  {product.category
                    ? `${product.name ?? 'Tanpa nama'} · ${rate ? formatRupiah(rate) : '—'}/potong`
                    : 'Kategori belum diisi'}
                </span>
              </span>
              {!product.isActive && <InactiveBadge />}
              <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function PatternsPanel({ data }: { data: MasterData }) {
  const openEditor = useMasterDataUiStore((state) => state.openEditor)

  if (data.patterns.length === 0) {
    return (
      <EmptyState
        icon={SquareDashedKanban}
        title="Belum ada kode pola"
        description="Tambahkan kode pola seperti P-133. Nanti tinggal dipilih saat membuat WO."
        action={
          <Button type="button" onClick={() => openEditor({ kind: 'pattern', pattern: null })}>
            <Plus />
            Tambah pola
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {data.patterns.map((pattern) => {
        const products = data.products.filter((product) => product.defaultPatternId === pattern.id)
        return (
          <li key={pattern.id}>
            <button
              type="button"
              onClick={() => openEditor({ kind: 'pattern', pattern })}
              className={cn(
                'surface interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-surface-hover',
                !pattern.isActive && 'opacity-60',
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-background/60 text-metal-200">
                <SquareDashedKanban className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium font-mono text-sm">{pattern.code}</span>
                <span className="block truncate text-muted-foreground text-xs">
                  {products.length > 0
                    ? `Bawaan ${products.map((product) => product.code).join(', ')}`
                    : 'Belum jadi bawaan produk'}
                </span>
              </span>
              {!pattern.isActive && <InactiveBadge />}
              <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface InlineAddFormProps {
  placeholder: string
  ariaLabel: string
  isPending: boolean
  onAdd: (name: string, reset: () => void) => void
}

function InlineAddForm({ placeholder, ariaLabel, isPending, onAdd }: InlineAddFormProps) {
  const [name, setName] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim().replace(/\s+/g, ' ').toUpperCase()
    if (!trimmed) return
    onAdd(trimmed, () => setName(''))
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoCapitalize="characters"
        className="h-10 uppercase placeholder:normal-case"
      />
      <Button
        type="submit"
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-label={ariaLabel}
        disabled={isPending}
      >
        <Plus />
      </Button>
    </form>
  )
}

function duplicateOr(error: AppError, message: string) {
  return error.kind === 'business' && error.code === 'DUPLICATE' ? message : describeError(error)
}

function SeriesBlock({ fabric, series }: { fabric: Fabric; series: FabricSeries }) {
  const saveColor = useSaveColor()
  const remove = useRemoveMasterData()

  return (
    <div className="space-y-2.5 rounded-xl border bg-background/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-xs uppercase tracking-wider">
          {series.name}
          <span className="ml-2 font-normal text-muted-foreground normal-case tracking-normal">
            {series.colors.length} warna
          </span>
        </p>
        {series.colors.length === 0 && fabric.series.length > 1 && (
          <button
            type="button"
            aria-label={`Hapus ${series.name}`}
            onClick={() =>
              remove.mutate(
                { kind: 'series', id: series.id },
                { onError: (error) => toast.error(describeError(error)) },
              )
            }
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {series.colors.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {series.colors.map((color) => (
            <li
              key={color.id}
              className="flex animate-pop items-center gap-1 rounded-full border bg-background/50 py-1 pr-1 pl-3 text-xs"
            >
              {color.name}
              <button
                type="button"
                aria-label={`Hapus warna ${color.name} ${series.name}`}
                onClick={() =>
                  remove.mutate(
                    { kind: 'color', id: color.id },
                    { onError: (error) => toast.error(describeError(error)) },
                  )
                }
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <InlineAddForm
        placeholder="Tambah warna"
        ariaLabel={`Tambah warna ${fabric.name} ${series.name}`}
        isPending={saveColor.isPending}
        onAdd={(name, reset) =>
          saveColor.mutate(
            { id: null, seriesId: series.id, name, isActive: true },
            {
              onSuccess: reset,
              onError: (error) =>
                toast.error(duplicateOr(error, `Warna ${name} sudah ada di ${series.name}`)),
            },
          )
        }
      />
    </div>
  )
}

function FabricCard({ fabric }: { fabric: Fabric }) {
  const openEditor = useMasterDataUiStore((state) => state.openEditor)
  const saveSeries = useSaveSeries()
  const colorCount = fabric.series.reduce((sum, series) => sum + series.colors.length, 0)

  return (
    <li
      className={cn(
        'surface flex flex-col gap-3 rounded-2xl p-4',
        !fabric.isActive && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => openEditor({ kind: 'fabric', fabric })}
        className="group flex items-center gap-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-background/60 text-metal-200">
          <Shirt className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-sm">{fabric.name}</span>
          <span className="block text-muted-foreground text-xs">
            {fabric.series.length} seri · {colorCount} warna
          </span>
        </span>
        {!fabric.isActive && <InactiveBadge />}
        <ChevronRight className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
      {fabric.series.map((series) => (
        <SeriesBlock key={series.id} fabric={fabric} series={series} />
      ))}
      <InlineAddForm
        placeholder={fabric.series.length === 0 ? 'Tambah seri, mis. SERI 1' : 'Tambah seri baru'}
        ariaLabel={`Tambah seri ${fabric.name}`}
        isPending={saveSeries.isPending}
        onAdd={(name, reset) =>
          saveSeries.mutate(
            { id: null, fabricId: fabric.id, name, isActive: true },
            {
              onSuccess: reset,
              onError: (error) =>
                toast.error(duplicateOr(error, `${name} sudah ada di ${fabric.name}`)),
            },
          )
        }
      />
    </li>
  )
}

export function FabricsPanel({ data }: { data: MasterData }) {
  const openEditor = useMasterDataUiStore((state) => state.openEditor)

  if (data.fabrics.length === 0) {
    return (
      <EmptyState
        icon={Shirt}
        title="Belum ada bahan"
        description="Tambahkan bahan seperti BLACK SWAN, lalu daftar warnanya."
        action={
          <Button type="button" onClick={() => openEditor({ kind: 'fabric', fabric: null })}>
            <Plus />
            Tambah bahan
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.fabrics.map((fabric) => (
        <FabricCard key={fabric.id} fabric={fabric} />
      ))}
    </ul>
  )
}

export function SizesPanel({ data }: { data: MasterData }) {
  const openEditor = useMasterDataUiStore((state) => state.openEditor)
  const saveSize = useSaveSize()

  const move = (index: number, direction: -1 | 1) => {
    const ordered = [...data.sizes]
    const target = index + direction
    const current = ordered[index]
    const neighbour = ordered[target]
    if (!current || !neighbour) return
    ordered[index] = neighbour
    ordered[target] = current
    ordered.forEach((size: Size, position) => {
      if (size.sortOrder !== position * 10) {
        saveSize.mutate({
          id: size.id,
          name: size.name,
          sortOrder: position * 10,
          isActive: size.isActive,
        })
      }
    })
  }

  if (data.sizes.length === 0) {
    return (
      <EmptyState
        icon={Ruler}
        title="Belum ada ukuran"
        description="Tambahkan ukuran seperti MIDI. Urutannya bisa diatur."
        action={
          <Button type="button" onClick={() => openEditor({ kind: 'size', size: null })}>
            <Plus />
            Tambah ukuran
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-2 sm:max-w-xl">
      {data.sizes.map((size, index) => (
        <li
          key={size.id}
          className={cn(
            'surface flex items-center gap-2 rounded-2xl p-2 pl-4',
            !size.isActive && 'opacity-60',
          )}
        >
          <span className="w-6 font-mono text-subtle-foreground text-xs tabular-nums">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => openEditor({ kind: 'size', size })}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left font-medium text-sm"
          >
            <span className="truncate">{size.name}</span>
            {!size.isActive && <InactiveBadge />}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Naikkan ${size.name}`}
            disabled={index === 0 || saveSize.isPending}
            onClick={() => move(index, -1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Turunkan ${size.name}`}
            disabled={index === data.sizes.length - 1 || saveSize.isPending}
            onClick={() => move(index, 1)}
          >
            <ArrowDown />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function WageRatesPanel({ data }: { data: MasterData }) {
  const removeRate = useRemoveMasterData()

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {data.wageRates.map((group) => (
        <section key={group.category} className="surface flex flex-col gap-5 rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Kategori {group.category}
              </p>
              <p className="text-metal font-mono font-semibold text-3xl tabular-nums tracking-tight">
                {group.current ? formatRupiah(group.current.amount) : '—'}
              </p>
              <p className="text-muted-foreground text-xs">
                {group.current
                  ? `per potong · sejak ${formatIsoDate(group.current.effectiveFrom)}`
                  : 'Belum ada tarif'}
              </p>
            </div>
            <span className="sheen-primary flex size-10 items-center justify-center rounded-xl font-semibold text-primary-foreground">
              {group.category}
            </span>
          </div>
          <ul className="space-y-1.5 border-t pt-4">
            {group.history.map((rate) => (
              <li key={rate.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-muted-foreground">
                  {formatIsoDate(rate.effectiveFrom)}
                </span>
                <span className="font-mono tabular-nums">{formatRupiah(rate.amount)}</span>
                {rate.isCurrent && (
                  <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success text-xs">
                    Berlaku
                  </span>
                )}
                {rate.isFuture && (
                  <button
                    type="button"
                    aria-label="Hapus tarif yang belum berlaku"
                    onClick={() =>
                      removeRate.mutate(
                        { kind: 'wage_rate', id: rate.id },
                        {
                          onSuccess: () => toast.success('Tarif dihapus'),
                          onError: (error) => toast.error(describeError(error)),
                        },
                      )
                    }
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
