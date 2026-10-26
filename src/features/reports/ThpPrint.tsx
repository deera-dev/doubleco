import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { formatPayDay } from '@/features/payroll/lib/dates'
import { type ThpData, type ThpRow, useThp } from '@/features/reports/api'
import { A4_LANDSCAPE, chunk, ReportPage, Sheet } from '@/features/reports/ReportSheet'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

/** Like the paper THP: 15 lines per sheet, the rest filled in by hand. */
const ROWS_PER_SHEET = 15

const cell = 'border border-print-ink px-[1mm]'
const center = `${cell} text-center`

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[2mm] border-print-line border-b border-dotted py-[0.6mm]">
      <span className="w-[34mm] shrink-0 text-print-muted print-text-xs">{label}</span>
      <span className="min-w-0 truncate font-bold print-text-sm">{value}</span>
    </div>
  )
}

function Signature({ title }: { title: string }) {
  return (
    <div className="flex h-[24mm] flex-1 flex-col items-center justify-between border border-print-ink p-[1.5mm]">
      <span className="font-bold uppercase print-text-xs">{title}</span>
      <span className="w-[40mm] border-print-ink border-t pt-[0.5mm] text-center text-print-muted print-text-2xs">
        nama & tanda tangan
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
    <Sheet paper={A4_LANDSCAPE} className="gap-[3mm] p-[9mm]">
      <header className="flex items-start justify-between gap-[6mm]">
        <div className="space-y-[2mm]">
          <MaryamLogo className="h-[10mm]" />
          <p className="font-extrabold print-text-md uppercase">Tanda hasil produksi (THP)</p>
        </div>
        <div className="w-[130mm]">
          <Info label="Kode barang" value={workOrder.productCode} />
          <Info label="Hari, tgl proses" value={formatPayDay(workOrder.orderedOn)} />
          <Info label="Cutter's name" value={workOrder.cutterName} />
          <Info
            label="Bahan & kombinasi"
            value={[workOrder.fabricName, workOrder.fabricCombination].filter(Boolean).join(' + ')}
          />
          <Info label="Size" value={sizeName} />
        </div>
      </header>

      <table className="w-full table-fixed border-collapse print-text-xs leading-tight">
        <colgroup>
          <col className="w-[8mm]" />
          <col className="w-[46mm]" />
          <col className="w-[13mm]" />
          <col className="w-[16mm]" />
          <col className="w-[22mm]" />
          <col className="w-[18mm]" />
          <col className="w-[18mm]" />
          <col className="w-[13mm]" />
          <col className="w-[13mm]" />
          <col />
          <col className="w-[20mm]" />
        </colgroup>
        <thead className="font-bold uppercase print-text-2xs">
          <tr className="h-[5mm] bg-[#eeeeee]">
            <th colSpan={6} className={center}>
              Kepala produksi
            </th>
            <th colSpan={4} className={center}>
              Kepala finishing
            </th>
            <th className={center}>Gudang</th>
          </tr>
          <tr className="h-[4.5mm]">
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
              Hasil produksi
            </th>
            <th rowSpan={2} className={`${cell} text-left`}>
              Keterangan
            </th>
            <th rowSpan={2} className={center}>
              ACC gudang
            </th>
          </tr>
          <tr className="h-[4.5mm]">
            <th className={center}>Ambil</th>
            <th className={center}>Selesai</th>
            <th className={center}>Diterima</th>
            <th className={center}>OK</th>
            <th className={center}>Rusak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.cardNumber} className="h-[6.4mm]">
              <td className={center}>{offset + index + 1}</td>
              <td className={`${cell} truncate font-semibold`}>
                {row.tailorName ?? ''}
                <span className="ml-[1.5mm] font-mono font-normal text-print-muted print-text-2xs">
                  {row.cardNumber}
                </span>
              </td>
              <td className={center}>{row.tailorCode ?? ''}</td>
              <td className={`${center} font-bold`}>{row.quantity}</td>
              <td className={center}>{formatWorkOrderDate(row.takenOn)}</td>
              <td className={center}>
                {row.submittedOn ? `✓ ${formatWorkOrderDate(row.submittedOn).slice(0, 5)}` : ''}
              </td>
              <td className={center}>{row.receivedQuantity ?? ''}</td>
              <td className={center}>{row.okQuantity ?? ''}</td>
              <td className={center}>{row.defectiveQuantity || ''}</td>
              <td className={`${cell} truncate print-text-2xs`}>{row.notes ?? ''}</td>
              <td className={cell} />
            </tr>
          ))}
          {blanks.map((blank) => (
            <tr key={`blank-${blank}`} className="h-[6.4mm]">
              <td className={center}>{offset + rows.length + blank + 1}</td>
              {Array.from({ length: 10 }, (_, column) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: empty cells to write in
                <td key={column} className={cell} />
              ))}
            </tr>
          ))}
          {page === pages - 1 && (
            <tr className="h-[6mm] font-bold">
              <td colSpan={3} className={`${cell} text-right uppercase`}>
                Total jumlah :
              </td>
              <td className={center}>{totals.quantity}</td>
              <td colSpan={3} className={`${cell} text-right uppercase`}>
                Hasil produksi :
              </td>
              <td className={center}>{totals.ok || ''}</td>
              <td colSpan={3} className={cell} />
            </tr>
          )}
        </tbody>
      </table>

      <footer className="mt-auto space-y-[1mm]">
        <div className="flex gap-[4mm]">
          <Signature title="Produksi" />
          <Signature title="Finishing" />
          <Signature title="Gudang" />
        </div>
        <p className="flex justify-between text-print-muted print-text-2xs">
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
      paper={A4_LANDSCAPE}
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
