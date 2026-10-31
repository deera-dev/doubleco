import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { formatPayDay } from '@/features/payroll/lib/dates'
import { usePrintSettings } from '@/features/print-settings/api'
import { useDocumentPrint } from '@/features/print-settings/use-document-print'
import { type ThpData, type ThpRow, useThp } from '@/features/reports/api'
import { chunk, ReportPage, Sheet, THP_PAPER } from '@/features/reports/ReportSheet'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

/** Like the paper THP: 15 lines per sheet, the rest filled in by hand. */
const ROWS_PER_SHEET = 15

/*
 * THP goes through an Epson LQ-310 (dot matrix) on 24 × 27,7 cm continuous paper. Pins print
 * thin or grey strokes faintly, so everything here is solid black, bold and on full lines.
 * Arial is on every PC: the printout then measures text exactly like the page on screen.
 */
const THP_FONT = 'Arial, Helvetica, sans-serif'
const cell = 'border-[0.35mm] border-print-ink px-[1mm]'
const center = `${cell} text-center`

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[2mm] border-print-ink border-b-[0.3mm] py-[0.5mm]">
      <span className="w-[31mm] shrink-0 font-semibold print-text-sm">{label}</span>
      <span className="min-w-0 font-extrabold print-text-md leading-tight">{value}</span>
    </div>
  )
}

function Signature({ title }: { title: string }) {
  return (
    <div className="flex w-[31mm] shrink-0 flex-col items-center justify-between border-[0.35mm] border-print-ink p-[1.5mm]">
      <span className="font-extrabold uppercase print-text-sm">{title}</span>
      <span className="w-full border-print-ink border-t-[0.3mm] pt-[0.5mm] text-center font-semibold print-text-2xs">
        nama & ttd
      </span>
    </div>
  )
}

function ThpSheet({
  data,
  sizeName,
  rows,
  page,
  pages,
  offset,
  totals,
}: {
  data: ThpData
  sizeName: string
  rows: ThpRow[]
  page: number
  pages: number
  offset: number
  totals: { quantity: number; ok: number }
}) {
  const { workOrder } = data
  const blanks = Array.from(
    { length: Math.max(0, ROWS_PER_SHEET - rows.length) },
    (_, index) => index,
  )

  return (
    // 14mm top and bottom keep clear of the tractor-hole strips; 9mm left and right.
    <Sheet
      paper={THP_PAPER}
      fontFamily={THP_FONT}
      className="gap-[2.5mm] px-[9mm] py-[14mm] font-semibold"
    >
      <header className="flex items-stretch gap-[3mm]">
        <div className="w-[38mm] shrink-0 space-y-[1.5mm]">
          <MaryamLogo className="h-[9mm]" />
          <p className="font-extrabold print-text-md uppercase leading-tight">
            Tanda hasil
            <br />
            produksi (THP)
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <Info label="Kode barang" value={workOrder.productCode} />
          <Info label="Hari, tgl proses" value={formatPayDay(workOrder.orderedOn)} />
          <Info label="Cutter's name" value={workOrder.cutterName} />
          <Info
            label="Bahan & kombinasi"
            value={[workOrder.fabricName, workOrder.fabricCombination].filter(Boolean).join(' + ')}
          />
          <Info label="Size" value={sizeName} />
        </div>
        <div className="flex shrink-0 gap-[1.5mm]">
          <Signature title="Produksi" />
          <Signature title="Finishing" />
          <Signature title="Gudang" />
        </div>
      </header>

      <table className="w-full table-fixed border-collapse print-text-sm leading-tight">
        <colgroup>
          <col className="w-[8mm]" />
          <col />
          <col className="w-[14mm]" />
          <col className="w-[16mm]" />
          <col className="w-[26mm]" />
          <col className="w-[20mm]" />
          <col className="w-[19mm]" />
          <col className="w-[14mm]" />
          <col className="w-[15mm]" />
          <col className="w-[52mm]" />
          <col className="w-[18mm]" />
        </colgroup>
        <thead className="font-extrabold uppercase text-[2.6mm]">
          <tr className="h-[5mm]">
            <th colSpan={6} className={center}>
              Kepala produksi
            </th>
            <th colSpan={4} className={center}>
              Kepala finishing
            </th>
            <th className={center}>Gudang</th>
          </tr>
          <tr className="h-[5mm]">
            <th rowSpan={2} className={center}>
              No
            </th>
            <th rowSpan={2} className={`${cell} text-left`}>
              Nama operator
            </th>
            <th rowSpan={2} className={center}>
              Kode
            </th>
            <th rowSpan={2} className={center}>
              Jumlah
            </th>
            <th className={center}>Tanggal</th>
            <th className={center}>Centang</th>
            <th className={center}>Jumlah</th>
            <th colSpan={2} className={center}>
              Hasil prod.
            </th>
            <th rowSpan={2} className={`${cell} text-left`}>
              Keterangan
            </th>
            <th rowSpan={2} className={center}>
              ACC
              <br />
              gudang
            </th>
          </tr>
          <tr className="h-[5mm]">
            <th className={center}>Ambil</th>
            <th className={center}>Selesai</th>
            <th className={center}>Diterima</th>
            <th className={center}>OK</th>
            <th className={center}>Rusak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.cardNumber} className="h-[8.5mm]">
              <td className={center}>{offset + index + 1}</td>
              <td className={`${cell} truncate font-extrabold print-text-md`}>
                {row.tailorName ?? ''}
              </td>
              <td className={`${center} font-extrabold print-text-md`}>{row.tailorCode ?? ''}</td>
              <td className={`${center} font-extrabold print-text-md`}>{row.quantity}</td>
              <td className={center}>{formatWorkOrderDate(row.takenOn)}</td>
              <td className={center}>
                {row.submittedOn ? `✓ ${formatWorkOrderDate(row.submittedOn).slice(0, 5)}` : ''}
              </td>
              <td className={`${center} print-text-md`}>{row.receivedQuantity ?? ''}</td>
              <td className={`${center} print-text-md`}>{row.okQuantity ?? ''}</td>
              <td className={`${center} print-text-md`}>{row.defectiveQuantity || ''}</td>
              <td className={`${cell} truncate print-text-xs`}>{row.notes ?? ''}</td>
              <td className={cell} />
            </tr>
          ))}
          {blanks.map((blank) => (
            <tr key={`blank-${blank}`} className="h-[8.5mm]">
              <td className={center}>{offset + rows.length + blank + 1}</td>
              {Array.from({ length: 10 }, (_, column) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: empty cells to write in
                <td key={column} className={cell} />
              ))}
            </tr>
          ))}
          {page === pages - 1 && (
            <tr className="h-[8.5mm] font-extrabold">
              <td colSpan={3} className={`${cell} text-right uppercase`}>
                Total jumlah :
              </td>
              <td className={`${center} print-text-md`}>{totals.quantity}</td>
              <td colSpan={3} className={`${cell} text-right uppercase`}>
                Hasil produksi :
              </td>
              <td className={`${center} print-text-md`}>{totals.ok || ''}</td>
              <td colSpan={3} className={cell} />
            </tr>
          )}
        </tbody>
      </table>

      <footer className="mt-auto">
        <p className="flex justify-between font-semibold print-text-xs">
          <span>{workOrder.number}</span>
          {pages > 1 && (
            <span>
              {sizeName} · hal {page + 1}/{pages}
            </span>
          )}
        </p>
      </footer>
    </Sheet>
  )
}

export function ThpPrint({ workOrderId }: { workOrderId: string }) {
  const thp = useThp(workOrderId)
  const printLog = useDocumentPrint('thp', workOrderId)
  const offsets = usePrintSettings().data?.settings.find(
    (setting) => setting.documentType === 'thp',
  )
  const data = thp.data
  const sheets =
    data?.sizes.flatMap((size) => {
      const pages = chunk(size.rows, ROWS_PER_SHEET)
      const totals = {
        quantity: size.rows.reduce((sum, row) => sum + row.quantity, 0),
        ok: size.rows.reduce((sum, row) => sum + (row.okQuantity ?? 0), 0),
      }
      return pages.map((rows, page) => ({
        key: `${size.name}-${page}`,
        sizeName: size.name,
        rows,
        page,
        pages: pages.length,
        offset: page * ROWS_PER_SHEET,
        totals,
      }))
    }) ?? []

  return (
    <ReportPage
      paper={THP_PAPER}
      printerGroup="thp"
      monochrome
      offsets={offsets ? { top: offsets.top, left: offsets.left } : undefined}
      back={
        <Button asChild variant="ghost" size="sm">
          <Link to="/work-order/$id" params={{ id: workOrderId }}>
            <ArrowLeft />
            Kembali ke WO
          </Link>
        </Button>
      }
      summary={data ? `${sheets.length} lembar THP` : undefined}
      fileName={`thp-${data?.workOrder.productCode ?? 'wo'}.pdf`}
      isReady={data !== undefined && sheets.length > 0}
      {...printLog}
    >
      {thp.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(thp.error))}
        </p>
      ) : !data ? (
        <div className="h-[50vh] w-full max-w-4xl animate-pulse rounded-lg bg-surface-hover" />
      ) : sheets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          WO ini belum punya kartu jahit. THP dibuat dari kartu jahit per ukuran.
        </p>
      ) : (
        sheets.map(({ key, ...sheet }) => <ThpSheet key={key} data={data} {...sheet} />)
      )}
    </ReportPage>
  )
}
