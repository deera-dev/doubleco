import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import markSvg from '@/assets/maryam-mark.svg?raw'
import { useRecordPrint } from '@/features/sewing-cards/api/mutations'
import { useCardPrint } from '@/features/sewing-cards/api/queries'
import type { PrintData, SewingCard } from '@/features/sewing-cards/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { PrintToolbar } from '@/shared/components/PrintToolbar'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { qrDataUri } from '@/shared/lib/qr'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const PAGE_STYLE = '@page { size: 60mm 100mm; margin: 0; }'

function Row({
  label,
  children,
  className,
}: {
  label: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-[2mm] border-print-line border-b border-dotted py-[0.3mm]',
        className,
      )}
    >
      <span className="w-[19mm] shrink-0 font-semibold text-print-muted uppercase print-text-label leading-tight">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-extrabold text-print-red uppercase print-text-value leading-tight">
        {children}
      </span>
    </div>
  )
}

/** Written by hand: who takes the card is only known at the cutting table. The line sits low to write on. */
function HandwrittenRow({ label }: { label: string }) {
  return (
    <div className="h-[9mm] border-print-ink border-b-[0.3mm] pt-[0.8mm]">
      <span className="font-semibold text-print-muted uppercase print-text-label">{label}</span>
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
      data-print-sheet
      className="kj-card-sheet relative flex flex-col overflow-hidden bg-print-paper p-[4mm] text-print-ink"
      style={{ transform: `translate(${offsets.left}mm, ${offsets.top}mm)` }}
    >
      <header className="flex items-center justify-between border-print-ink border-b-[0.5mm] pb-[1.2mm]">
        <MaryamLogo className="h-[7.5mm]" />
        <span className="flex size-[6mm] items-center justify-center rounded-[1mm] border-[0.4mm] border-print-ink font-extrabold print-text-sm">
          {card.category}
        </span>
      </header>

      <div className="mt-[1mm]">
        <Row label="Tgl">{formatWorkOrderDate(card.takenOn)}</Row>
        <Row label="T.Potong">{card.cutterName}</Row>
        <Row label="Model">{card.productCode}</Row>
        <Row label="Ukuran">{card.sizeName}</Row>
        {card.colorName && <Row label="Warna">{card.colorName}</Row>}
        <Row label="Jumlah">{card.quantity}</Row>
        <div className="mt-[0.5mm]">
          <HandwrittenRow label="T.Jahit" />
          <HandwrittenRow label="Kode" />
        </div>
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
        await Promise.all(
          numbers.map(
            async (value) => [value, await qrDataUri(value, { logoSvg: markSvg })] as const,
          ),
        ),
      ),
    enabled: numbers.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Reprinting a lost card is fine; the note just says it is not the first copy. */
function printedNote(cards: SewingCard[]): string | undefined {
  const printedBefore = cards.filter((card) => card.printCount > 0)
  if (printedBefore.length === 0) return undefined
  if (cards.length === 1) return `Kartu ini sudah dicetak ${cards[0]?.printCount}×`
  return `${printedBefore.length} dari ${cards.length} kartu sudah pernah dicetak`
}

export function SewingCardPrint({ numbers }: { numbers: string[] }) {
  const print = useCardPrint(numbers)
  const printed = print.data?.cards.map((card) => card.number) ?? []
  const qr = useQrImages(printed)
  const recordPrint = useRecordPrint()
  const isReady = print.data !== undefined && printed.length > 0 && qr.data !== undefined

  return (
    <div className="min-h-dvh print:min-h-0">
      <style>{PAGE_STYLE}</style>
      <PrintToolbar
        back={
          <Button asChild variant="ghost" size="sm">
            <Link to="/kartu-jahit">
              <ArrowLeft />
              Kartu Jahit
            </Link>
          </Button>
        }
        paper="60 × 100 mm"
        summary={`${printed.length} kartu`}
        widthMm={60}
        heightMm={100}
        offsets={print.data?.offsets ?? { top: 0, left: 0 }}
        fileName={`kartu-jahit-${printed[0] ?? 'cetak'}${printed.length > 1 ? `-dst` : ''}.pdf`}
        isReady={isReady}
        printedNote={printedNote(print.data?.cards ?? [])}
        onPrinted={() => recordPrint.mutate({ numbers: printed })}
      />

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
