import { type ReactNode, useEffect, useState } from 'react'
import { PrintToolbar } from '@/shared/components/PrintToolbar'
import type { PrinterGroup } from '@/shared/lib/direct-print'
import { cn } from '@/shared/lib/utils'

const CSS_PX_PER_MM = 96 / 25.4

export interface Paper {
  label: string
  width: number
  height: number
}

export const A4_PORTRAIT: Paper = { label: 'A4', width: 210, height: 297 }
export const A4_LANDSCAPE: Paper = { label: 'A4 mendatar', width: 297, height: 210 }
/** THP: continuous form for the Epson LQ-310, 24 × 27,7 cm. */
export const THP_PAPER: Paper = { label: '24 × 27,7 cm', width: 240, height: 277 }

/** Shrinks a sheet wider than the screen; printing and the PDF always use the real size. */
function useSheetScale(widthMm: number) {
  const [viewport, setViewport] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return Math.min(1, (viewport - 32) / (widthMm * CSS_PX_PER_MM))
}

export function Sheet({
  paper,
  children,
  className,
}: {
  paper: Paper
  children: ReactNode
  className?: string
}) {
  const scale = useSheetScale(paper.width)
  return (
    <div
      className="shrink-0 shadow-2xl print:h-auto! print:w-auto! print:break-after-page print:shadow-none print:last:break-after-auto"
      style={{ width: `${paper.width * scale}mm`, height: `${paper.height * scale}mm` }}
    >
      <article
        data-print-sheet
        className={cn(
          'flex origin-top-left flex-col overflow-hidden bg-print-paper text-print-ink print:transform-none!',
          className,
        )}
        style={{
          width: `${paper.width}mm`,
          height: `${paper.height}mm`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </article>
    </div>
  )
}

interface ReportPageProps {
  paper: Paper
  back: ReactNode
  summary?: string
  fileName: string
  isReady: boolean
  /** Filters and notes shown above the sheets, never printed. */
  controls?: ReactNode
  printedNote?: string
  onPrinted?: () => void
  /** Which printer from Kalibrasi Cetak takes this paper. */
  printerGroup?: PrinterGroup
  /** Pure black and white output, for the dot-matrix printer. */
  monochrome?: boolean
  children: ReactNode
}

export function ReportPage({
  paper,
  back,
  summary,
  fileName,
  isReady,
  controls,
  printedNote,
  onPrinted,
  printerGroup = 'report',
  monochrome = false,
  children,
}: ReportPageProps) {
  return (
    <div className="min-h-dvh print:min-h-0">
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      <PrintToolbar
        back={back}
        paper={paper.label}
        summary={summary}
        widthMm={paper.width}
        heightMm={paper.height}
        offsets={{ top: 0, left: 0 }}
        fileName={fileName}
        isReady={isReady}
        showCalibrationLink={false}
        printerGroup={printerGroup}
        monochrome={monochrome}
        printedNote={printedNote}
        onPrinted={onPrinted}
      />
      {controls && <div className="mx-auto max-w-5xl px-4 pt-4 print:hidden">{controls}</div>}
      <div className="flex flex-col items-center gap-6 px-4 py-6 print:block print:p-0">
        {children}
      </div>
    </div>
  )
}

const numberFormat = new Intl.NumberFormat('id-ID')

/** Plain amounts for report tables, like the Excel sheets: "1.970.000". Zero shows as blank. */
export function amount(value: number | null | undefined): string {
  return value ? numberFormat.format(value) : ''
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  )
}
