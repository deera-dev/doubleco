import { Link } from '@tanstack/react-router'
import { ArrowLeft, Minus, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  type PrintDocument,
  usePrintSettings,
  useSavePrintSetting,
} from '@/features/print-settings/api'
import { DirectPrintSettings } from '@/features/print-settings/DirectPrintSettings'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PrintToolbar } from '@/shared/components/PrintToolbar'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

type CalibratedPaper = 'sewing_card' | 'work_order_card' | 'thp'

const papers: Record<CalibratedPaper, { label: string; width: number; height: number }> = {
  sewing_card: { label: 'Kartu jahit', width: 60, height: 100 },
  work_order_card: { label: 'Kartu WO', width: 120, height: 150 },
  // Continuous form on the LQ-310, printed landscape like the THP itself.
  thp: { label: 'THP', width: 277, height: 240 },
}

/** The test sheet draws its marks this far from the paper edge. */
const MARK_MM = 10
const STEP_MM = 0.5

function clampOffset(value: number) {
  return Math.min(20, Math.max(-20, Math.round(value * 10) / 10))
}

function OffsetField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{label}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          aria-label={`${label} kurangi`}
          onClick={() => onChange(clampOffset(value - STEP_MM))}
        >
          <Minus />
        </Button>
        <Input
          inputMode="decimal"
          value={String(value)}
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(',', '.'))
            if (Number.isFinite(parsed)) onChange(clampOffset(parsed))
          }}
          aria-label={`${label} (mm)`}
          className="h-12 w-24 text-center font-mono text-lg"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          aria-label={`${label} tambah`}
          onClick={() => onChange(clampOffset(value + STEP_MM))}
        >
          <Plus />
        </Button>
        <span className="text-muted-foreground text-sm">mm</span>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  )
}

function TestSheet({
  paper,
  offsets,
}: {
  paper: { label: string; width: number; height: number }
  offsets: { top: number; left: number }
}) {
  const ticks = (length: number) =>
    Array.from({ length: Math.floor(length / 5) + 1 }, (_, i) => i * 5)
  return (
    <article
      data-print-sheet
      className="relative overflow-hidden bg-white text-black"
      style={{
        width: `${paper.width}mm`,
        height: `${paper.height}mm`,
        transform: `translate(${offsets.left}mm, ${offsets.top}mm)`,
      }}
    >
      {/* Ruler along the top and left edges, every 5 mm. */}
      {ticks(paper.width).map((mm) => (
        <span
          key={`x${mm}`}
          className="absolute top-0 border-black border-l"
          style={{ left: `${mm}mm`, height: mm % 10 === 0 ? '4mm' : '2mm' }}
        />
      ))}
      {ticks(paper.height).map((mm) => (
        <span
          key={`y${mm}`}
          className="absolute left-0 border-black border-t"
          style={{ top: `${mm}mm`, width: mm % 10 === 0 ? '4mm' : '2mm' }}
        />
      ))}
      {/* The frame should land exactly 10 mm inside every edge. */}
      <div
        className="absolute border-[0.3mm] border-black"
        style={{
          top: `${MARK_MM}mm`,
          left: `${MARK_MM}mm`,
          right: `${MARK_MM}mm`,
          bottom: `${MARK_MM}mm`,
        }}
      />
      <div
        className="absolute flex flex-col items-center justify-center gap-[1mm] text-center"
        style={{ inset: `${MARK_MM + 3}mm` }}
      >
        <p className="font-bold" style={{ fontSize: '4mm' }}>
          Uji cetak {paper.label}
        </p>
        <p style={{ fontSize: '2.6mm' }}>
          {paper.width} × {paper.height} mm
        </p>
        <p style={{ fontSize: '2.6mm' }}>
          Garis kotak harus tepat {MARK_MM} mm dari setiap tepi kertas.
        </p>
        <p style={{ fontSize: '2.6mm' }}>
          Geser saat ini: atas {offsets.top} mm · kiri {offsets.left} mm
        </p>
      </div>
      <span
        className="absolute size-[6mm] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.3mm] border-black"
        style={{ top: '50%', left: '50%' }}
      />
    </article>
  )
}

function Editor({ initial }: { initial: Record<PrintDocument, { top: number; left: number }> }) {
  const save = useSavePrintSetting()
  const [document, setDocument] = useState<CalibratedPaper>('sewing_card')
  const [drafts, setDrafts] = useState(initial)
  const paper = papers[document]
  const offsets = drafts[document]
  const isChanged = offsets.top !== initial[document].top || offsets.left !== initial[document].left
  const setOffsets = (next: Partial<{ top: number; left: number }>) =>
    setDrafts((current) => ({ ...current, [document]: { ...current[document], ...next } }))

  return (
    <div className="min-h-dvh">
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      <PrintToolbar
        back={
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft />
              Beranda
            </Link>
          </Button>
        }
        paper={`${paper.width} × ${paper.height} mm`}
        summary="Uji cetak"
        widthMm={paper.width}
        heightMm={paper.height}
        // The sheet on screen is already shifted; the PDF applies the same shift on paper.
        offsets={offsets}
        fileName={`uji-cetak-${document}.pdf`}
        isReady
        showCalibrationLink={false}
        printerGroup={document}
        monochrome={document === 'thp'}
      />
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 print:hidden">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl tracking-tight">Kalibrasi cetak</h1>
          <p className="text-muted-foreground text-sm">
            Pilih printer untuk cetak langsung, dan atur geser kalau hasil cetak bergeser dari
            kertas.
          </p>
        </div>
        <DirectPrintSettings />
        <SegmentedControl
          label="Jenis kertas"
          value={document}
          onChange={setDocument}
          className="w-fit max-w-full"
          options={[
            { value: 'sewing_card', label: 'Kartu jahit 6×10' },
            { value: 'work_order_card', label: 'Kartu WO 12×15' },
            { value: 'thp', label: 'THP 24×27,7' },
          ]}
        />
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Cetak halaman uji di bawah (Cetak, atau PDF dari HP).</li>
          <li>
            Ukur dengan penggaris: garis kotak harus tepat {MARK_MM} mm dari tepi atas dan kiri.
          </li>
          <li>
            Kalau garis terlalu ke bawah, kurangi <b>Atas</b>; terlalu ke kanan, kurangi <b>Kiri</b>
            . Contoh: garis 12 mm dari atas → Atas −2.
          </li>
          <li>Simpan, lalu cetak ulang halaman uji untuk memastikan.</li>
        </ol>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <OffsetField
            label="Atas"
            hint="Plus = turun, minus = naik"
            value={offsets.top}
            onChange={(top) => setOffsets({ top })}
          />
          <OffsetField
            label="Kiri"
            hint="Plus = ke kanan, minus = ke kiri"
            value={offsets.left}
            onChange={(left) => setOffsets({ left })}
          />
        </div>
        {save.error && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(save.error)}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={!isChanged || save.isPending}
          onClick={() =>
            save.mutate(
              { documentType: document, ...offsets },
              { onSuccess: () => toast.success(`Kalibrasi ${paper.label.toLowerCase()} disimpan`) },
            )
          }
        >
          <Save />
          {save.isPending ? 'Menyimpan…' : 'Simpan kalibrasi'}
        </Button>
      </div>
      <div className="flex justify-center p-6 print:p-0">
        <div className="shadow-2xl print:shadow-none">
          <TestSheet paper={paper} offsets={offsets} />
        </div>
      </div>
    </div>
  )
}

export function CalibrationPage() {
  const settings = usePrintSettings()

  if (settings.isPending) return <ListSkeleton rows={3} />
  if (settings.isError) {
    return (
      <p role="alert" className="p-6 text-destructive text-sm">
        {describeError(toAppError(settings.error))}
      </p>
    )
  }
  const initial = Object.fromEntries(
    settings.data.settings.map((setting) => [
      setting.documentType,
      { top: setting.top, left: setting.left },
    ]),
  ) as Record<PrintDocument, { top: number; left: number }>
  for (const key of ['sewing_card', 'work_order_card', 'thp', 'transfer_list'] as const) {
    initial[key] ??= { top: 0, left: 0 }
  }
  return <Editor initial={initial} />
}
