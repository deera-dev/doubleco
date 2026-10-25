import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useWorkOrderPrint } from '@/features/work-orders/api/queries'
import type { PrintData } from '@/features/work-orders/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { formatIsoDate, todayIsoDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const PAGE_STYLE = '@page { size: 120mm 160mm; margin: 0; }'

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-semibold text-print-muted uppercase tracking-wider print-text-2xs">
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-[0.6mm]">
      <Label>{label}</Label>
      <p className="truncate font-bold print-text-md leading-tight">{children}</p>
    </div>
  )
}

function ChangeStatus({ workOrder }: { workOrder: PrintData['workOrder'] }) {
  const isChanged = workOrder.changeStatus === 'changed'
  return (
    <div
      className={cn(
        'space-y-[1mm] rounded-[1.5mm] border-[0.5mm] p-[2.2mm]',
        isChanged ? 'border-print-red' : 'border-print-blue',
      )}
    >
      <Label>Status sampel</Label>
      <p
        className={cn(
          'font-extrabold print-text-md leading-tight',
          isChanged ? 'text-print-red' : 'text-print-blue',
        )}
      >
        {isChanged ? 'ADA PERUBAHAN' : 'TIDAK ADA PERUBAHAN'}
      </p>
      <p
        className={cn(
          'line-clamp-4 print-text-xs leading-snug',
          isChanged ? 'font-semibold text-print-red' : 'text-print-blue',
        )}
      >
        {isChanged ? workOrder.changeNotes : 'Jahit persis mengikuti sampel.'}
      </p>
    </div>
  )
}

function CutMatrix({ matrix }: { matrix: PrintData['cutMatrix'] }) {
  const cell = cn(
    'border border-print-line px-[1.2mm]',
    matrix.rows.length > 3 ? 'py-[0.3mm]' : 'py-[0.7mm]',
  )
  return (
    <div className="space-y-[1mm]">
      <div className="flex items-baseline justify-between">
        <Label>Rincian potong (pcs)</Label>
        <span className="text-print-muted print-text-2xs">Kosong = isi manual</span>
      </div>
      <table className="w-full table-fixed border-collapse text-center print-text-xs">
        <thead>
          <tr className="font-semibold text-print-muted">
            <th className={cn(cell, 'w-[28%] text-left')}>Warna</th>
            {matrix.sizes.map((size) => (
              <th key={size} className={cn(cell, 'truncate')}>
                {size}
              </th>
            ))}
            <th className={cn(cell, 'w-[16%]')}>Jumlah</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {matrix.rows.map((row) => (
            <tr key={row.color}>
              <td className={cn(cell, 'truncate text-left font-sans font-semibold')}>
                {row.color}
              </td>
              {row.cells.map((value, index) => (
                <td
                  key={matrix.sizes[index]}
                  className={cn(cell, !value.planned && 'bg-print-line/40 text-print-muted')}
                >
                  {value.planned ? (value.quantity ?? '') : '–'}
                </td>
              ))}
              <td className={cn(cell, 'font-bold')}>{row.total ?? ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cn(cell, 'text-left font-sans')} colSpan={matrix.sizes.length + 1}>
              Total
            </td>
            <td className={cell}>{matrix.total ?? ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function WorkOrderCard({ data, onPhotoSettled }: CardProps) {
  const { workOrder, offsets, cutMatrix } = data

  return (
    <article
      className="wo-card-sheet relative flex flex-col gap-[3mm] overflow-hidden bg-print-paper p-[6mm] text-print-ink"
      style={{ transform: `translate(${offsets.left}mm, ${offsets.top}mm)` }}
    >
      <header className="flex items-start justify-between gap-[3mm] border-print-ink border-b-[0.6mm] pb-[2mm]">
        <div className="min-w-0 space-y-[0.6mm]">
          <Label>Kartu work order</Label>
          <p
            className={cn(
              'truncate font-extrabold font-mono leading-none',
              workOrder.number.length > 16 ? 'print-text-lg' : 'print-text-xl',
            )}
          >
            {workOrder.number}
          </p>
          <p className="truncate print-text-sm">
            <span className="font-bold">{workOrder.productCode}</span>
            {workOrder.productName ? ` · ${workOrder.productName}` : ''}
          </p>
        </div>
        {workOrder.category && (
          <div className="flex shrink-0 flex-col items-center rounded-[1.5mm] border-[0.5mm] border-print-ink px-[2.4mm] py-[1mm]">
            <span className="font-semibold text-print-muted uppercase print-text-2xs">
              Kategori
            </span>
            <span className="font-extrabold print-text-xl leading-none">{workOrder.category}</span>
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 gap-x-[4mm] gap-y-[2mm]">
        <Field label="Tanggal">{formatWorkOrderDate(workOrder.orderedOn)}</Field>
        <Field label="Tukang potong">{workOrder.cutterName}</Field>
        <Field label="Bahan">{workOrder.fabricName}</Field>
        <Field label="Kombinasi">{workOrder.fabricCombination ?? '—'}</Field>
        <Field label="Kode pola">{workOrder.patternCode ?? '—'}</Field>
        <Field label="Ukuran">{workOrder.sizes.join(' · ')}</Field>
      </section>

      <section className="flex flex-1 gap-[3mm]">
        <div className="wo-card-photo flex shrink-0 flex-col gap-[1mm]">
          <Label>Foto sampel</Label>
          <div className="relative flex min-h-[30mm] flex-1 items-center justify-center overflow-hidden rounded-[1.5mm] border border-print-line">
            {workOrder.photoUrl ? (
              <img
                src={workOrder.photoUrl}
                alt={`Foto sampel ${workOrder.productCode}`}
                className="absolute inset-0 size-full object-contain"
                onLoad={onPhotoSettled}
                onError={onPhotoSettled}
              />
            ) : (
              <p className="px-[3mm] text-center text-print-muted print-text-2xs">
                Foto sampel belum diunggah
              </p>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2.5mm]">
          <ChangeStatus workOrder={workOrder} />
          <div className="min-h-0 space-y-[0.8mm]">
            <Label>Info lanjutan</Label>
            <p className="line-clamp-2 font-semibold print-text-xs leading-snug">
              {workOrder.additionalInfo ?? 'Info lebih lanjut hubungi tukang potong.'}
            </p>
          </div>
        </div>
      </section>

      <CutMatrix matrix={cutMatrix} />

      <footer className="flex items-end justify-between border-print-line border-t pt-[1.5mm] text-print-muted print-text-2xs">
        <span>Dicetak {formatIsoDate(todayIsoDate())}</span>
        <span className="font-mono">{workOrder.number}</span>
      </footer>
    </article>
  )
}

interface CardProps {
  data: PrintData
  onPhotoSettled: () => void
}

export function WorkOrderPrint({ id }: { id: string }) {
  const print = useWorkOrderPrint(id)
  const [settledPhoto, setSettledPhoto] = useState<string | null>(null)
  const photoUrl = print.data?.workOrder.photoUrl ?? null
  const isReady = print.data !== undefined && (photoUrl === null || settledPhoto === photoUrl)

  return (
    <div className="min-h-dvh print:min-h-0">
      <style>{PAGE_STYLE}</style>
      <div className="chrome sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/work-order/$id" params={{ id }}>
            <ArrowLeft />
            Kembali ke WO
          </Link>
        </Button>
        <p className="hidden text-muted-foreground text-sm md:block">
          Kertas 120 × 160 mm · skala 100% · tanpa margin
        </p>
        <Button type="button" onClick={() => window.print()} disabled={!isReady}>
          <Printer />
          Cetak
        </Button>
      </div>
      <div className="flex justify-center p-6 print:p-0">
        {print.isPending ? (
          <div className="wo-card-sheet animate-pulse rounded-lg bg-surface-hover" />
        ) : print.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {describeError(toAppError(print.error))}
          </p>
        ) : (
          <div className="shadow-2xl print:shadow-none">
            <WorkOrderCard data={print.data} onPhotoSettled={() => setSettledPhoto(photoUrl)} />
          </div>
        )}
      </div>
    </div>
  )
}
