import { Link } from '@tanstack/react-router'
import { FileDown, Printer } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { buildPdf, isTouchDevice, shareOrDownload } from '@/shared/lib/print-pdf'

interface PrintToolbarProps {
  back: ReactNode
  /** Paper size, e.g. "60 × 100 mm". */
  paper: string
  /** What is printed, e.g. "3 kartu". */
  summary?: string
  widthMm: number
  heightMm: number
  offsets: { top: number; left: number }
  fileName: string
  isReady: boolean
  /** Called once a print or PDF was made, e.g. to count prints. */
  onPrinted?: () => void
  /** Hidden on the calibration page itself. */
  showCalibrationLink?: boolean
}

/** Sheets rendered on the page carry `data-print-sheet`; each becomes one PDF page. */
export function printSheets(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-print-sheet]')]
}

export function PrintToolbar({
  back,
  paper,
  summary,
  widthMm,
  heightMm,
  offsets,
  fileName,
  isReady,
  onPrinted,
  showCalibrationLink = true,
}: PrintToolbarProps) {
  const [isBuilding, setIsBuilding] = useState(false)
  const preferPdf = isTouchDevice()

  const makePdf = async () => {
    setIsBuilding(true)
    try {
      const file = await buildPdf({ sheets: printSheets(), widthMm, heightMm, offsets, fileName })
      onPrinted?.()
      await shareOrDownload(file)
    } catch {
      toast.error('PDF gagal dibuat. Coba lagi.')
    } finally {
      setIsBuilding(false)
    }
  }

  const printNow = () => {
    onPrinted?.()
    window.print()
  }

  const pdfButton = (
    <Button
      type="button"
      variant={preferPdf ? 'default' : 'outline'}
      onClick={makePdf}
      disabled={!isReady || isBuilding}
    >
      <FileDown />
      {isBuilding ? 'Membuat PDF…' : 'PDF'}
    </Button>
  )
  const printButton = (
    <Button
      type="button"
      variant={preferPdf ? 'outline' : 'default'}
      onClick={printNow}
      disabled={!isReady}
    >
      <Printer />
      Cetak
    </Button>
  )

  return (
    <div className="chrome sticky top-0 z-10 space-y-2 border-b px-4 py-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <p className="hidden text-muted-foreground text-sm md:block">
          {summary ? `${summary} · ` : ''}kertas {paper} · skala 100% · tanpa margin
        </p>
        <div className="flex gap-2">
          {preferPdf ? (
            <>
              {printButton}
              {pdfButton}
            </>
          ) : (
            <>
              {pdfButton}
              {printButton}
            </>
          )}
        </div>
      </div>
      {(preferPdf || showCalibrationLink) && (
        <p className="text-muted-foreground text-xs">
          {preferPdf &&
            `Dari HP: tekan PDF, pilih aplikasi printer, lalu atur kertas ${paper} dan skala 100% (jangan "sesuaikan halaman"). `}
          {showCalibrationLink && (
            <>
              Hasil bergeser?{' '}
              <Link
                to="/cetak/kalibrasi"
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                Kalibrasi cetak
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
