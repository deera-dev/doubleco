import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRecordPrint } from '@/features/sewing-cards/api/mutations'
import { useCardPrint } from '@/features/sewing-cards/api/queries'
import type { PrintData, SewingCard } from '@/features/sewing-cards/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { qrDataUri } from '@/shared/lib/qr'
import { toAppError } from '@/shared/types/errors'

const PAGE_STYLE = '@page { size: 60mm 100mm; margin: 0; }'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-[2mm] border-print-line border-b border-dotted py-[0.7mm]">
      <span className="w-[15mm] shrink-0 font-semibold text-print-muted uppercase print-text-2xs">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-bold print-text-sm leading-tight">
        {children}
      </span>
    </div>
  )
}

interface CardSheetProps {
  card: SewingCard
  qr: string | undefined
  offsets: PrintData['offsets']
}

function CardSheet({ card, qr, offsets }: CardSheetProps) {
  return (
    <article
      className="kj-card-sheet relative flex flex-col overflow-hidden bg-print-paper p-[4mm] text-print-ink"
      style={{ transform: `translate(${offsets.left}mm, ${offsets.top}mm)` }}
    >
      <header className="flex items-center justify-between border-print-ink border-b-[0.5mm] pb-[1.2mm]">
        <MaryamLogo className="h-[9mm]" />
        <span className="flex size-[6mm] items-center justify-center rounded-[1mm] border-[0.4mm] border-print-ink font-extrabold print-text-sm">
          {card.category}
        </span>
      </header>

      <div className="mt-[1mm]">
        <Row label="Tgl">{formatWorkOrderDate(card.takenOn)}</Row>
        <Row label="T.Potong">{card.cutterName}</Row>
        <Row label="Model">{card.productCode}</Row>
        <Row label="Ukuran">{card.sizeName}</Row>
        <Row label="Warna">{card.colorName}</Row>
        <Row label="Jumlah">
          <span className="print-text-md">{card.quantity}</span> pcs
        </Row>
        <Row label="T.Jahit">{card.tailorName}</Row>
        <Row label="Kode">
          <span className="font-mono print-text-lg leading-none">{card.tailorCode}</span>
        </Row>
      </div>

      <div className="mt-auto flex items-end gap-[2.5mm] pt-[2mm]">
        {qr ? (
          <img src={qr} alt={`QR ${card.number}`} className="kj-card-qr shrink-0" />
        ) : (
          <div className="kj-card-qr shrink-0 bg-print-line" />
        )}
        <div className="min-w-0 flex-1 space-y-[1.5mm]">
          <div>
            <p className="font-semibold text-print-muted uppercase print-text-2xs">No. kartu</p>
            <p className="font-extrabold font-mono print-text-sm leading-tight">{card.number}</p>
          </div>
          <div className="h-[10mm] rounded-[1mm] border border-print-line px-[1mm] pt-[0.5mm]">
            <p className="font-semibold text-print-muted uppercase print-text-2xs">TTD</p>
          </div>
        </div>
      </div>
    </article>
  )
}

function useQrImages(numbers: string[]) {
  return useQuery({
    queryKey: ['qr-images', numbers],
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(numbers.map(async (value) => [value, await qrDataUri(value)] as const)),
      ),
    enabled: numbers.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function SewingCardPrint({ numbers }: { numbers: string[] }) {
  const print = useCardPrint(numbers)
  const printed = print.data?.cards.map((card) => card.number) ?? []
  const qr = useQrImages(printed)
  const recordPrint = useRecordPrint()
  const isReady = print.data !== undefined && printed.length > 0 && qr.data !== undefined

  const printNow = () => {
    recordPrint.mutate({ numbers: printed })
    window.print()
  }

  return (
    <div className="min-h-dvh print:min-h-0">
      <style>{PAGE_STYLE}</style>
      <div className="chrome sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/potong-bagi">
            <ArrowLeft />
            Potong & Bagi
          </Link>
        </Button>
        <p className="hidden text-muted-foreground text-sm md:block">
          {printed.length} kartu · kertas 60 × 100 mm · skala 100% · tanpa margin
        </p>
        <Button type="button" onClick={printNow} disabled={!isReady}>
          <Printer />
          Cetak {printed.length > 1 ? `${printed.length} kartu` : ''}
        </Button>
      </div>

      {numbers.length === 0 ? (
        <p className="p-6 text-center text-muted-foreground text-sm">
          Tidak ada nomor kartu yang dipilih.
        </p>
      ) : print.isPending ? (
        <div className="flex justify-center p-6">
          <div className="kj-card-sheet animate-pulse rounded-lg bg-surface-hover" />
        </div>
      ) : print.isError ? (
        <p role="alert" className="p-6 text-center text-destructive text-sm">
          {describeError(toAppError(print.error))}
        </p>
      ) : (
        <>
          {print.data.missing.length > 0 && (
            <p className="px-6 pt-4 text-center text-sm text-warning print:hidden">
              Tidak ditemukan: {print.data.missing.join(', ')}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-6 p-6 print:block print:p-0">
            {print.data.cards.map((card) => (
              <div
                key={card.id}
                className="shadow-2xl print:break-after-page print:shadow-none print:last:break-after-auto"
              >
                <CardSheet card={card} qr={qr.data?.[card.number]} offsets={print.data.offsets} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
