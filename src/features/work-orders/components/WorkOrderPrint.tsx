import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { useWorkOrderPrint } from '@/features/work-orders/api/queries'
import type { PrintData } from '@/features/work-orders/api/schema'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { formatIsoDate, todayIsoDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const PAGE_STYLE = '@page { size: 120mm 160mm; margin: 0; }'

export function workOrderQrPayload(id: string): string {
  return `DC-WO:${id}`
}

function useQrImage(payload: string) {
  return useQuery({
    queryKey: ['qr-image', payload],
    queryFn: async () => {
      const svg = await QRCode.toString(payload, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      })
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p className="truncate font-bold font-mono italic print-text-lg leading-snug">{children}</p>
  )
}

function WorkOrderCard({ data }: { data: PrintData }) {
  const { workOrder, offsets } = data
  const qr = useQrImage(workOrderQrPayload(workOrder.id))
  const isChanged = workOrder.changeStatus === 'changed'

  return (
    <article
      className="wo-card-sheet relative flex flex-col overflow-hidden bg-print-paper p-[6mm] text-print-ink"
      style={{ transform: `translate(${offsets.left}mm, ${offsets.top}mm)` }}
    >
      <header className="flex items-start justify-between gap-[4mm]">
        <div className="min-w-0 space-y-[1.2mm]">
          <Line>{formatWorkOrderDate(workOrder.orderedOn)}</Line>
          <Line>{workOrder.cutterName}</Line>
          <Line>{workOrder.productCode}</Line>
          <Line>{workOrder.sizes.join(' · ')}</Line>
          <Line>
            {workOrder.fabricName}
            {workOrder.fabricCombination ? `+${workOrder.fabricCombination}` : ''}
          </Line>
          <p className="truncate font-mono text-print-muted print-text-sm">
            {workOrder.colors.join(', ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-[1mm]">
          {qr.data ? (
            <img src={qr.data} alt={`QR ${workOrder.number}`} className="wo-card-qr" />
          ) : (
            <div className="wo-card-qr bg-print-line" />
          )}
          <p className="font-mono print-text-xs">POLA {workOrder.patternCode ?? '—'}</p>
        </div>
      </header>

      <div className="mt-[5mm] flex flex-1 gap-[4mm]">
        <div className="wo-card-photo flex shrink-0 items-center justify-center border border-print-line border-dashed text-center text-print-muted print-text-xs">
          TEMPEL FOTO
          <br />
          SAMPEL
        </div>
        <div className="min-w-0 flex-1 space-y-[3mm]">
          <p
            className={cn(
              'font-bold italic print-text-lg leading-tight',
              isChanged ? 'text-print-red' : 'text-print-blue',
            )}
          >
            {isChanged ? 'ADA PERUBAHAN' : 'TIDAK ADA PERUBAHAN (IKUT SAMPEL)'}
          </p>
          {workOrder.changeNotes && (
            <p className="font-semibold text-print-red print-text-sm leading-snug">
              {workOrder.changeNotes}
            </p>
          )}
          <p className="font-bold font-mono text-print-blue italic print-text-sm leading-snug">
            {workOrder.additionalInfo ?? '-INFO LEBIH LANJUT HUBUNGI TUKANG POTONG'}
          </p>
        </div>
      </div>

      <footer className="mt-[4mm] flex items-end justify-between border-print-line border-t pt-[2mm] print-text-xs">
        <span className="font-bold font-mono print-text-sm">{workOrder.number}</span>
        <span className="text-print-muted">Dicetak {formatIsoDate(todayIsoDate())}</span>
      </footer>
    </article>
  )
}

export function WorkOrderPrint({ id }: { id: string }) {
  const print = useWorkOrderPrint(id)

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
        <Button type="button" onClick={() => window.print()} disabled={!print.data}>
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
            <WorkOrderCard data={print.data} />
          </div>
        )}
      </div>
    </div>
  )
}
