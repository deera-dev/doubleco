import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { usePayrollOverview } from '@/features/payroll/api/queries'
import type { PayrollLine } from '@/features/payroll/api/schema'
import { formatPayDay, formatWeek } from '@/features/payroll/lib/dates'
import { A4_PORTRAIT, amount, chunk, ReportPage, Sheet } from '@/features/reports/ReportSheet'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

const CATEGORIES = ['S', 'M', 'L'] as const
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
/** Three rows (S/M/L) per tailor: this many tailors fill an A4 page. */
const TAILORS_PER_PAGE = 17

interface CategoryRow {
  category: (typeof CATEGORIES)[number]
  days: number[]
  pieces: number
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
    return {
      category,
      days,
      pieces: cards.reduce((sum, card) => sum + card.quantity, 0),
      wage: cards.reduce((sum, card) => sum + card.wage, 0),
    }
  })
}

const cell = 'border border-print-ink px-[0.8mm]'
const number = `${cell} text-right font-mono tabular-nums`

function TailorRows({ line, index }: { line: PayrollLine; index: number }) {
  const rows = categoryRows(line)
  return (
    <>
      {rows.map((row, rowIndex) => (
        <tr key={row.category} className="h-[4.6mm]">
          {rowIndex === 0 && (
            <>
              <td rowSpan={3} className={`${cell} text-center`}>
                {index}
              </td>
              <td rowSpan={3} className={`${cell} font-bold`}>
                <span className="block truncate">{line.name}</span>
                <span className="block font-normal text-print-muted print-text-2xs">
                  kode {line.code}
                </span>
              </td>
            </>
          )}
          <td className={`${cell} text-center font-semibold`}>{row.category}</td>
          {row.days.map((value, day) => (
            <td key={DAYS[day]} className={`${number} text-center`}>
              {value || ''}
            </td>
          ))}
          <td className={`${number} text-center`}>{row.pieces || ''}</td>
          {rowIndex === 0 && (
            <td rowSpan={3} className={`${number} text-center font-bold`}>
              {line.pieces || ''}
            </td>
          )}
          <td className={number}>{amount(row.wage)}</td>
          {rowIndex === 0 && (
            <>
              <td rowSpan={3} className={`${number} font-bold`}>
                {amount(line.grossWage)}
              </td>
              <td rowSpan={3} className={number}>
                {amount(line.newAdvanceTotal)}
              </td>
              <td rowSpan={3} className={number}>
                {amount(line.advanceRepayment)}
              </td>
              <td rowSpan={3} className={`${number} font-bold`}>
                {amount(line.transferAmount)}
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  )
}

export function DepositRecapPrint({ payOn }: { payOn: string }) {
  const overview = usePayrollOverview(payOn)
  const data = overview.data
  const pages = chunk(data?.lines ?? [], TAILORS_PER_PAGE)
  const totals = (data?.lines ?? []).reduce(
    (sum, line) => ({
      pieces: sum.pieces + line.pieces,
      wage: sum.wage + line.grossWage,
      advance: sum.advance + line.newAdvanceTotal,
      repayment: sum.repayment + line.advanceRepayment,
      transfer: sum.transfer + line.transferAmount,
    }),
    { pieces: 0, wage: 0, advance: 0, repayment: 0, transfer: 0 },
  )

  return (
    <ReportPage
      paper={A4_PORTRAIT}
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
    >
      {overview.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(overview.error))}
        </p>
      ) : !data ? (
        <div className="h-[60vh] w-full max-w-3xl animate-pulse rounded-lg bg-surface-hover" />
      ) : (
        pages.map((lines, pageIndex) => (
          <Sheet key={lines[0]?.id ?? 'empty'} paper={A4_PORTRAIT} className="gap-[3mm] p-[8mm]">
            <header className="flex items-end justify-between gap-[4mm] border-print-ink border-b-[0.5mm] pb-[2mm]">
              <MaryamLogo className="h-[9mm]" />
              <div className="text-right">
                <p className="font-extrabold print-text-md uppercase">Rekap setoran jahit</p>
                <p className="font-semibold print-text-xs">
                  Gajian {formatPayDay(data.payOn)} · setoran{' '}
                  {formatWeek(data.startsOn, data.payOn)}
                </p>
              </div>
            </header>
            <table className="w-full table-fixed border-collapse print-text-2xs leading-tight">
              <colgroup>
                <col className="w-[6mm]" />
                <col className="w-[25mm]" />
                <col className="w-[6mm]" />
                {DAYS.map((day) => (
                  <col key={day} className="w-[8.5mm]" />
                ))}
                <col className="w-[9mm]" />
                <col className="w-[10mm]" />
                <col className="w-[16mm]" />
                <col className="w-[17mm]" />
                <col className="w-[15mm]" />
                <col className="w-[14mm]" />
                <col />
              </colgroup>
              <thead>
                <tr className="h-[6mm] bg-[#eeeeee] font-bold uppercase">
                  <th className={cell}>No</th>
                  <th className={`${cell} text-left`}>Nama</th>
                  <th className={cell}>Kat</th>
                  {DAYS.map((day) => (
                    <th key={day} className={cell}>
                      {day}
                    </th>
                  ))}
                  <th className={cell}>Total</th>
                  <th className={cell}>Total jait</th>
                  <th className={cell}>Harga</th>
                  <th className={cell}>Total</th>
                  <th className={cell}>Kasbon</th>
                  <th className={cell}>Cicil</th>
                  <th className={cell}>Transfer</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <TailorRows
                    key={line.id}
                    line={line}
                    index={pageIndex * TAILORS_PER_PAGE + index + 1}
                  />
                ))}
                {pageIndex === pages.length - 1 && (
                  <tr className="h-[6mm] bg-[#eeeeee] font-bold">
                    <td colSpan={9} className={`${cell} text-right uppercase`}>
                      Total
                    </td>
                    <td className={`${number} text-center`} />
                    <td className={`${number} text-center`}>{totals.pieces || ''}</td>
                    <td className={number} />
                    <td className={number}>{amount(totals.wage)}</td>
                    <td className={number}>{amount(totals.advance)}</td>
                    <td className={number}>{amount(totals.repayment)}</td>
                    <td className={number}>{amount(totals.transfer)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {lines.length === 0 && (
              <p className="text-center text-print-muted print-text-sm">
                Belum ada setoran minggu ini.
              </p>
            )}
            <footer className="mt-auto flex justify-between text-print-muted print-text-2xs">
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
