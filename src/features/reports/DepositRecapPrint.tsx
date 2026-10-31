import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { usePayrollOverview } from '@/features/payroll/api/queries'
import type { PayrollLine } from '@/features/payroll/api/schema'
import { formatPayDay, formatWeek } from '@/features/payroll/lib/dates'
import { useDocumentPrint } from '@/features/print-settings/use-document-print'
import { A4_LANDSCAPE, amount, ReportPage, Sheet } from '@/features/reports/ReportSheet'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

const CATEGORIES = ['S', 'M', 'L'] as const
/** Senin..Sabtu as initials, like the old sheet: narrow columns leave room for bigger text. */
const DAYS = [
  { key: 'mon', label: 'S' },
  { key: 'tue', label: 'S' },
  { key: 'wed', label: 'R' },
  { key: 'thu', label: 'K' },
  { key: 'fri', label: 'J' },
  { key: 'sat', label: 'S' },
]
/**
 * Every tailor keeps the same three S/M/L rows, so the grid reads evenly. The rows are as low
 * as the 3.2mm text allows (4mm, no extra leading); 14 tailors fill a landscape A4 page.
 */
const ROWS_PER_PAGE = 42
const ROW_HEIGHT = 'h-[4mm] leading-none'

interface CategoryRow {
  category: (typeof CATEGORIES)[number]
  days: number[]
  wage: number
  pieces: number
  count: number
}

/** Monday is the first column; a card handed in on Sunday counts with that Monday. */
function dayColumn(isoDate: string | null): number {
  if (!isoDate) return 0
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return day === 0 ? 0 : day - 1
}

function categoryRows(line: PayrollLine): CategoryRow[] {
  const rows = CATEGORIES.map((category) => {
    const cards = line.cards.filter((card) => card.category === category)
    const days = DAYS.map(() => 0)
    for (const card of cards) days[dayColumn(card.submittedOn)] += card.quantity
    return {
      category,
      days,
      wage: cards.reduce((sum, card) => sum + card.wage, 0),
      pieces: cards.reduce((sum, card) => sum + card.quantity, 0),
      count: cards.length,
    }
  })
  return rows
}

/** Fills pages by rows, so short entries let more tailors share a page. */
function paginate(lines: PayrollLine[], lastPageReserve: number): PayrollLine[][] {
  const pages: PayrollLine[][] = [[]]
  let used = 0
  for (const line of lines) {
    const height = categoryRows(line).length
    if (used + height > ROWS_PER_PAGE && (pages.at(-1)?.length ?? 0) > 0) {
      pages.push([])
      used = 0
    }
    pages.at(-1)?.push(line)
    used += height
  }
  // The sample rows sit at the bottom of the last page; give them a page of their own if needed.
  if (used + lastPageReserve > ROWS_PER_PAGE && (pages.at(-1)?.length ?? 0) > 0) pages.push([])
  return pages
}

/**
 * Money columns of one tailor. Total + tambahan + kasbon − cicil is the transfer (a rare
 * potongan is in the transfer too). Kasbon is only what this transfer pays out; sisa kasbon is
 * the debt left after this week's cicilan, for information.
 */
function moneyOf(line: PayrollLine, isLocked: boolean) {
  return {
    wage: line.grossWage + line.samples.amount,
    additions: line.additionTotal - line.samples.amount,
    newAdvance: line.newAdvanceTotal,
    repayment: line.advanceRepayment,
    // Locked weeks have booked the cicilan already; open ones still take it off.
    balance: Math.max(line.advanceBalance - (isLocked ? 0 : line.advanceRepayment), 0),
    transfer: line.transferAmount,
  }
}

type Money = ReturnType<typeof moneyOf>
const moneyColumns: { key: keyof Money; label: string; bold?: boolean }[] = [
  { key: 'wage', label: 'Total', bold: true },
  { key: 'additions', label: 'Tambahan' },
  { key: 'newAdvance', label: 'Kasbon' },
  { key: 'repayment', label: 'Cicil' },
  { key: 'balance', label: 'Sisa kasbon' },
  { key: 'transfer', label: 'Transfer', bold: true },
]

const cell = 'border border-print-ink px-[1mm]'
const number = `${cell} text-right tabular-nums`

function TailorRows({
  line,
  index,
  isLocked,
}: {
  line: PayrollLine
  index: number
  isLocked: boolean
}) {
  const rows = categoryRows(line)
  const span = rows.length
  const money = moneyOf(line, isLocked)
  return (
    <>
      {rows.map((row, rowIndex) => (
        <tr key={row.category} className={ROW_HEIGHT}>
          {rowIndex === 0 && (
            <>
              <td rowSpan={span} className={`${cell} text-center print-text-sm`}>
                {index}
              </td>
              <td rowSpan={span} className={`${cell} truncate font-bold print-text-sm`}>
                {line.name}
                <span className="ml-[1.5mm] font-semibold print-text-xs">KODE {line.code}</span>
              </td>
            </>
          )}
          <td className={`${cell} text-center font-semibold print-text-sm`}>{row.category}</td>
          {row.days.map((value, day) => (
            <td key={DAYS[day]?.key} className={`${cell} text-center tabular-nums print-text-sm`}>
              {value || ''}
            </td>
          ))}
          <td className={`${cell} text-center tabular-nums print-text-sm`}>{row.pieces || ''}</td>
          {rowIndex === 0 && (
            <td
              rowSpan={span}
              className={`${cell} text-center font-bold tabular-nums print-text-sm`}
            >
              {line.pieces || ''}
            </td>
          )}
          <td className={number}>{amount(row.wage)}</td>
          {rowIndex === 0 &&
            moneyColumns.map((column) => (
              <td
                key={column.key}
                rowSpan={span}
                className={`${number} ${column.bold ? 'font-bold' : ''}`}
              >
                {amount(money[column.key])}
              </td>
            ))}
        </tr>
      ))}
    </>
  )
}

/** Tukang sampel: one row at the bottom, samples instead of the S/M/L grid. */
function SampleRow({
  line,
  index,
  isLocked,
}: {
  line: PayrollLine
  index: number
  isLocked: boolean
}) {
  const money = moneyOf(line, isLocked)
  const parts = [
    line.samples.high > 0 ? `100rb × ${line.samples.high}` : null,
    line.samples.low > 0 ? `50rb × ${line.samples.low}` : null,
    line.pieces > 0 ? `jahit ${line.pieces} pcs` : null,
  ].filter(Boolean)
  return (
    <tr className={ROW_HEIGHT}>
      <td className={`${cell} text-center print-text-sm`}>{index}</td>
      <td className={`${cell} truncate font-bold print-text-sm`}>
        {line.name}
        <span className="ml-[1.5mm] font-semibold print-text-xs">KODE {line.code} · sampel</span>
      </td>
      <td colSpan={9} className={`${cell} print-text-sm`}>
        Sampel {parts.length > 0 ? parts.join(' · ') : '—'}
      </td>
      <td className={number}>{amount(line.samples.amount)}</td>
      {moneyColumns.map((column) => (
        <td key={column.key} className={`${number} ${column.bold ? 'font-bold' : ''}`}>
          {amount(money[column.key])}
        </td>
      ))}
    </tr>
  )
}

export function DepositRecapPrint({ payOn }: { payOn: string }) {
  const overview = usePayrollOverview(payOn)
  const printLog = useDocumentPrint('deposit_recap', payOn)
  const data = overview.data
  // Tukang sampel are listed apart, at the very bottom of the last page.
  const sewers = (data?.lines ?? []).filter((line) => !line.isSampleMaker)
  const sampleMakers = (data?.lines ?? []).filter((line) => line.isSampleMaker)
  const pages = paginate(sewers, sampleMakers.length)
  const isLocked = data?.status === 'locked'
  const totals = (data?.lines ?? []).reduce(
    (sum, line) => {
      const money = moneyOf(line, isLocked)
      for (const column of moneyColumns) sum[column.key] += money[column.key]
      if (!line.isSampleMaker) sum.pieces += line.pieces
      return sum
    },
    { pieces: 0, wage: 0, additions: 0, newAdvance: 0, repayment: 0, balance: 0, transfer: 0 },
  )

  return (
    <ReportPage
      paper={A4_LANDSCAPE}
      back={
        <Button asChild variant="ghost" size="sm">
          <Link to="/gajian" search={{ sabtu: payOn }}>
            <ArrowLeft />
            Gajian
          </Link>
        </Button>
      }
      summary={data ? `${data.lines.length} penjahit · ${pages.length} halaman` : undefined}
      fileName={`rekap-setoran-${payOn}.pdf`}
      isReady={data !== undefined && !overview.isPlaceholderData}
      {...printLog}
    >
      {overview.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(overview.error))}
        </p>
      ) : !data ? (
        <div className="h-[60vh] w-full max-w-3xl animate-pulse rounded-lg bg-surface-hover" />
      ) : (
        pages.map((lines, pageIndex) => (
          <Sheet
            key={lines[0]?.id ?? `page-${pageIndex}`}
            paper={A4_LANDSCAPE}
            className="gap-[1.5mm] px-[7mm] py-[5mm]"
          >
            <header className="flex items-center justify-between gap-[4mm] border-print-ink border-b-[0.4mm] pb-[1.5mm]">
              {/* As tall as the title block beside it. */}
              <MaryamLogo className="h-[10.5mm]" />
              <div className="text-right">
                <p className="font-extrabold print-text-lg uppercase">Rekap setoran jahit</p>
                <p className="font-semibold print-text-sm">
                  Gajian {formatPayDay(data.payOn)} · setoran{' '}
                  {formatWeek(data.startsOn, data.payOn)}
                </p>
              </div>
            </header>
            <table className="w-full table-fixed border-collapse print-text-xs leading-tight">
              <colgroup>
                <col className="w-[7mm]" />
                <col />
                <col className="w-[7mm]" />
                {DAYS.map((day) => (
                  <col key={day.key} className="w-[9mm]" />
                ))}
                <col className="w-[14mm]" />
                <col className="w-[13mm]" />
                <col className="w-[20mm]" />
                {moneyColumns.map((column) => (
                  <col
                    key={column.key}
                    className={column.key === 'transfer' ? 'w-[24mm]' : 'w-[20mm]'}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="h-[6mm] bg-[#eeeeee] font-bold uppercase leading-none">
                  <th className={cell}>No</th>
                  <th className={`${cell} text-left`}>Nama</th>
                  <th className={cell}>Kat</th>
                  {DAYS.map((day) => (
                    <th key={day.key} className={`${cell} print-text-sm`}>
                      {day.label}
                    </th>
                  ))}
                  <th className={cell}>
                    Pcs per
                    <br />
                    kat
                  </th>
                  <th className={cell}>Total jait</th>
                  <th className={cell}>Harga</th>
                  {moneyColumns.map((column) => (
                    <th key={column.key} className={cell}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <TailorRows
                    key={line.id}
                    line={line}
                    index={
                      pages.slice(0, pageIndex).reduce((sum, page) => sum + page.length, 0) +
                      index +
                      1
                    }
                    isLocked={isLocked}
                  />
                ))}
                {pageIndex === pages.length - 1 &&
                  sampleMakers.map((line, index) => (
                    <SampleRow
                      key={line.id}
                      line={line}
                      index={sewers.length + index + 1}
                      isLocked={isLocked}
                    />
                  ))}
                {pageIndex === pages.length - 1 && (
                  <tr className="h-[5.5mm] bg-[#eeeeee] font-bold leading-none">
                    <td colSpan={10} className={`${cell} text-right uppercase`}>
                      Total
                    </td>
                    <td className={`${cell} text-center tabular-nums print-text-sm`}>
                      {totals.pieces || ''}
                    </td>
                    <td className={number} />
                    {moneyColumns.map((column) => (
                      <td key={column.key} className={number}>
                        {amount(totals[column.key])}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            {lines.length === 0 && sampleMakers.length === 0 && (
              <p className="text-center text-print-muted print-text-sm">
                Belum ada setoran minggu ini.
              </p>
            )}
            <footer className="mt-auto flex justify-end text-print-muted print-text-xs">
              <span>
                Hal {pageIndex + 1}/{pages.length}
              </span>
            </footer>
          </Sheet>
        ))
      )}
    </ReportPage>
  )
}
