import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { usePayrollOverview } from '@/features/payroll/api/queries'
import type { PayrollLine } from '@/features/payroll/api/schema'
import { formatPayDay, formatWeek } from '@/features/payroll/lib/dates'
import { useDocumentPrint } from '@/features/print-settings/use-document-print'
import { A4_LANDSCAPE, amount, chunk, ReportPage, Sheet } from '@/features/reports/ReportSheet'
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
/** Three rows (S/M/L) per tailor: this many tailors fill a landscape A4 page. */
const TAILORS_PER_PAGE = 9

interface CategoryRow {
  category: (typeof CATEGORIES)[number]
  days: number[]
  wage: number
}

/** Monday is the first column; a card handed in on Sunday counts with that Monday. */
function dayColumn(isoDate: string | null): number {
  if (!isoDate) return 0
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return day === 0 ? 0 : day - 1
}

function categoryRows(line: PayrollLine): CategoryRow[] {
  return CATEGORIES.map((category) => {
    const cards = line.cards.filter((card) => card.category === category)
    const days = DAYS.map(() => 0)
    for (const card of cards) days[dayColumn(card.submittedOn)] += card.quantity
    return { category, days, wage: cards.reduce((sum, card) => sum + card.wage, 0) }
  })
}

/**
 * Money columns of one tailor, adding up to the transfer:
 * upah + sampel + tambahan − potongan + kasbon lama + kasbon baru − cicil.
 */
function moneyOf(line: PayrollLine, startsOn: string) {
  const oldAdvance = line.newAdvances
    .filter((advance) => advance.entryOn < startsOn)
    .reduce((sum, advance) => sum + advance.amount, 0)
  return {
    wage: line.grossWage,
    samples: line.samples.amount,
    additions: line.additionTotal - line.samples.amount,
    deductions: line.deductionTotal,
    oldAdvance,
    newAdvance: line.newAdvanceTotal - oldAdvance,
    repayment: line.advanceRepayment,
    transfer: line.transferAmount,
  }
}

type Money = ReturnType<typeof moneyOf>
const moneyColumns: { key: keyof Money; label: string; bold?: boolean }[] = [
  { key: 'wage', label: 'Total', bold: true },
  { key: 'samples', label: 'Sampel' },
  { key: 'additions', label: 'Tambahan' },
  { key: 'deductions', label: 'Potongan' },
  { key: 'oldAdvance', label: 'Kasbon lama' },
  { key: 'newAdvance', label: 'Kasbon baru' },
  { key: 'repayment', label: 'Cicil' },
  { key: 'transfer', label: 'Transfer', bold: true },
]

const cell = 'border border-print-ink px-[1mm]'
const number = `${cell} text-right tabular-nums`

function TailorRows({
  line,
  index,
  startsOn,
}: {
  line: PayrollLine
  index: number
  startsOn: string
}) {
  const rows = categoryRows(line)
  const money = moneyOf(line, startsOn)
  return (
    <>
      {rows.map((row, rowIndex) => (
        <tr key={row.category} className="h-[5.6mm]">
          {rowIndex === 0 && (
            <>
              <td rowSpan={3} className={`${cell} text-center print-text-sm`}>
                {index}
              </td>
              <td rowSpan={3} className={`${cell} font-bold print-text-sm`}>
                <span className="block truncate">{line.name}</span>
                <span className="block font-normal text-print-muted print-text-xs">
                  kode {line.code}
                </span>
              </td>
            </>
          )}
          <td className={`${cell} text-center font-semibold print-text-sm`}>{row.category}</td>
          {row.days.map((value, day) => (
            <td key={DAYS[day]?.key} className={`${cell} text-center tabular-nums print-text-sm`}>
              {value || ''}
            </td>
          ))}
          {rowIndex === 0 && (
            <td rowSpan={3} className={`${cell} text-center font-bold tabular-nums print-text-md`}>
              {line.pieces || ''}
            </td>
          )}
          <td className={number}>{amount(row.wage)}</td>
          {rowIndex === 0 &&
            moneyColumns.map((column) => (
              <td
                key={column.key}
                rowSpan={3}
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

export function DepositRecapPrint({ payOn }: { payOn: string }) {
  const overview = usePayrollOverview(payOn)
  const printLog = useDocumentPrint('deposit_recap', payOn)
  const data = overview.data
  const pages = chunk(data?.lines ?? [], TAILORS_PER_PAGE)
  const totals = (data?.lines ?? []).reduce(
    (sum, line) => {
      const money = moneyOf(line, data?.startsOn ?? '')
      for (const column of moneyColumns) sum[column.key] += money[column.key]
      sum.pieces += line.pieces
      return sum
    },
    {
      pieces: 0,
      wage: 0,
      samples: 0,
      additions: 0,
      deductions: 0,
      oldAdvance: 0,
      newAdvance: 0,
      repayment: 0,
      transfer: 0,
    },
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
          <Sheet key={lines[0]?.id ?? 'empty'} paper={A4_LANDSCAPE} className="gap-[3mm] p-[8mm]">
            <header className="flex items-end justify-between gap-[4mm] border-print-ink border-b-[0.5mm] pb-[2mm]">
              <MaryamLogo className="h-[9mm]" />
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
                <tr className="h-[7mm] bg-[#eeeeee] font-bold uppercase">
                  <th className={cell}>No</th>
                  <th className={`${cell} text-left`}>Nama</th>
                  <th className={cell}>Kat</th>
                  {DAYS.map((day) => (
                    <th key={day.key} className={`${cell} print-text-sm`}>
                      {day.label}
                    </th>
                  ))}
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
                    index={pageIndex * TAILORS_PER_PAGE + index + 1}
                    startsOn={data.startsOn}
                  />
                ))}
                {pageIndex === pages.length - 1 && (
                  <tr className="h-[7mm] bg-[#eeeeee] font-bold">
                    <td colSpan={9} className={`${cell} text-right uppercase`}>
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
            {lines.length === 0 && (
              <p className="text-center text-print-muted print-text-sm">
                Belum ada setoran minggu ini.
              </p>
            )}
            <footer className="mt-auto flex justify-between text-print-muted print-text-xs">
              <span>{data.status === 'locked' ? 'Gajian dikunci' : 'Gajian belum dikunci'}</span>
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
