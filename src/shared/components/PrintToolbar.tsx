import { Link } from '@tanstack/react-router'
import { FileDown, Printer } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { directPrinterFor, type PrinterGroup, printDirect } from '@/shared/lib/direct-print'
import {
  buildPdf,
  downloadFile,
  isTouchDevice,
  printPdf,
  shareOrDownload,
} from '@/shared/lib/print-pdf'

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
  /** E.g. "Sudah dicetak 2× · terakhir 31 Okt 10.12": printing again stays allowed. */
  printedNote?: string
  /** Which printer chosen in Kalibrasi Cetak takes this paper, for direct printing. */
  printerGroup: PrinterGroup
  /** Pure black and white output (no grey), for the dot-matrix printer. */
  monochrome?: boolean
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
  printedNote,
  printerGroup,
  monochrome = false,
}: PrintToolbarProps) {
  const [building, setBuilding] = useState<'print' | 'pdf' | null>(null)
  // Phones cannot print a PDF from inside a page; there it goes to the printer app instead.
  const isPhone = isTouchDevice()
  const directPrinter = isPhone ? null : directPrinterFor(printerGroup)

  const run = async (kind: 'print' | 'pdf') => {
    setBuilding(kind)
    try {
      const file = await buildPdf({
        sheets: printSheets(),
        widthMm,
        heightMm,
        offsets,
        fileName,
        monochrome,
      })
      onPrinted?.()
      if (kind === 'pdf') downloadFile(file)
      else if (isPhone) await shareOrDownload(file)
      else if (directPrinter) {
        try {
          await printDirect(directPrinter, file, { widthMm, heightMm })
          toast.success(`Dikirim ke ${directPrinter}`)
        } catch (error) {
          // QZ Tray closed or the printer refused: the normal dialog still gets it printed.
          console.error(error)
          toast.error('Cetak langsung gagal (QZ Tray belum jalan?). Membuka dialog cetak.')
          await printPdf(file)
        }
      } else await printPdf(file)
    } catch {
      toast.error(kind === 'print' ? 'Gagal membuka cetak. Coba lagi.' : 'PDF gagal dibuat.')
    } finally {
      setBuilding(null)
    }
  }

  return (
    <div className="chrome sticky top-0 z-10 space-y-2 border-b px-4 py-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <p className="hidden text-muted-foreground text-sm md:block">
          {summary ? `${summary} · ` : ''}kertas {paper} · skala 100% · tanpa margin
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => run('pdf')}
            disabled={!isReady || building !== null}
          >
            <FileDown />
            {building === 'pdf' ? 'Membuat PDF…' : 'Simpan PDF'}
          </Button>
          <Button
            type="button"
            onClick={() => run('print')}
            disabled={!isReady || building !== null}
          >
            <Printer />
            {building === 'print' ? 'Menyiapkan…' : 'Cetak'}
          </Button>
        </div>
      </div>
      {printedNote && (
        <p className="flex items-center gap-1.5 font-medium text-success text-xs">
          <Printer className="size-3.5" />
          {printedNote}. Boleh dicetak lagi.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        {isPhone
          ? `Cetak membuka daftar aplikasi: pilih aplikasi printer (mis. Epson Smart Panel, Canon PRINT, HP Smart, atau Mopria). `
          : ''}
        {directPrinter
          ? `Cetak langsung ke ${directPrinter}, kertas ${paper}, tanpa dialog. `
          : `Di dialog cetak pilih ukuran kertas ${paper} dan skala 100% / ukuran asli (jangan "sesuaikan halaman"). `}
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
    </div>
  )
}
