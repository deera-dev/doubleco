import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { usePayrollTailors } from '@/features/payroll/api/queries'
import { type TailorBook, useTailorHistory } from '@/features/reports/api'
import { A4_PORTRAIT, amount, chunk, ReportPage, Sheet } from '@/features/reports/ReportSheet'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { MaryamLogo } from '@/shared/components/MaryamLogo'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

const WEEKS_PER_PAGE = 40

const cell = 'border border-print-ink px-[1.5mm]'
const number = `${cell} text-right font-mono tabular-nums`

function BookSheet({
  tailor,
  weeks,
  page,
  pages,
  range,
}: {
  tailor: TailorBook
  weeks: TailorBook['weeks']
  page: number
  pages: number
  range: string
}) {
  const offset = page * WEEKS_PER_PAGE
  const totals = tailor.weeks.reduce(
    (sum, week) => ({
      advance: sum.advance + week.advance,
      wage: sum.wage + week.wage,
      repayment: sum.repayment + week.repayment,
    }),
    { advance: 0, wage: 0, repayment: 0 },
  )
  return (
    <Sheet paper={A4_PORTRAIT} className="gap-[4mm] p-[12mm]">
      <header className="flex items-start justify-between gap-[6mm] border-print-ink border-b-[0.5mm] pb-[3mm]">
        <div className="space-y-[1.5mm]">
          <MaryamLogo className="h-[9mm]" />
          <p className="text-print-muted print-text-xs">Rekap mingguan penjahit · {range}</p>
        </div>
        <div className="text-right">
          <p className="font-extrabold print-text-xl uppercase leading-none">{tailor.name}</p>
          <p className="font-semibold print-text-xs">kode {tailor.code}</p>
          {tailor.account ? (
            <>
              <p className="font-semibold print-text-sm">
                {tailor.account.provider} · {tailor.account.number}
              </p>
              <p className="print-text-xs">A/N : {tailor.account.holder}</p>
            </>
          ) : (
            <p className="text-print-muted print-text-xs">Rekening belum diisi</p>
          )}
        </div>
      </header>

      <table className="w-full table-fixed border-collapse print-text-xs leading-tight">
        <colgroup>
          <col className="w-[11mm]" />
          <col className="w-[34mm]" />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="h-[7mm] bg-[#eeeeee] font-bold uppercase">
            <th className={cell}>No</th>
            <th className={cell}>Tgl / perminggu</th>
            <th className={cell}>Kasbon</th>
            <th className={cell}>Upah</th>
            <th className={cell}>Bayar</th>
            <th className={cell}>Sisa kasbon</th>
          </tr>
        </thead>
        <tbody>
          {page === 0 && tailor.openingBalance !== 0 && (
            <tr className="h-[5.5mm] text-print-muted">
              <td className={cell} />
              <td className={cell}>Sisa sebelumnya</td>
              <td className={number} />
              <td className={number} />
              <td className={number} />
              <td className={number}>{amount(tailor.openingBalance)}</td>
            </tr>
          )}
          {weeks.map((week, index) => (
            <tr key={week.payOn} className="h-[5.5mm]">
              <td className={`${cell} text-center`}>{offset + index + 1}</td>
              <td className={`${cell} text-center`}>{formatWorkOrderDate(week.payOn)}</td>
              <td className={number}>{amount(week.advance)}</td>
              <td className={number}>{amount(week.wage)}</td>
              <td className={number}>{amount(week.repayment)}</td>
              <td className={`${number} font-semibold`}>{amount(week.balance) || '0'}</td>
            </tr>
          ))}
          {page === pages - 1 && (
            <tr className="h-[6mm] bg-[#eeeeee] font-bold">
              <td colSpan={2} className={`${cell} text-right uppercase`}>
                Total
              </td>
              <td className={number}>{amount(totals.advance)}</td>
              <td className={number}>{amount(totals.wage)}</td>
              <td className={number}>{amount(totals.repayment)}</td>
              <td className={number}>{amount(tailor.weeks.at(-1)?.balance ?? 0) || '0'}</td>
            </tr>
          )}
        </tbody>
      </table>
      {pages > 1 && (
        <p className="mt-auto text-right text-print-muted print-text-2xs">
          Hal {page + 1}/{pages}
        </p>
      )}
    </Sheet>
  )
}

interface TailorBookPrintProps {
  tailorId: string | null
  from: string
  to: string
}

export function TailorBookPrint({ tailorId, from, to }: TailorBookPrintProps) {
  const navigate = useNavigate({ from: '/cetak/rekap-penjahit' })
  const history = useTailorHistory({ tailorId, from, to })
  const tailors = usePayrollTailors()
  const data = history.data
  const range = `${formatWorkOrderDate(from)} s/d ${formatWorkOrderDate(to)}`
  const sheets =
    data?.tailors.flatMap((tailor) => {
      const pages = chunk(tailor.weeks, WEEKS_PER_PAGE)
      return pages.map((weeks, page) => ({
        key: `${tailor.id}-${page}`,
        tailor,
        weeks,
        page,
        pages: pages.length,
      }))
    }) ?? []
  const setSearch = (
    next: Partial<{ penjahit: string | undefined; dari: string; sampai: string }>,
  ) => navigate({ search: (current) => ({ ...current, ...next }), replace: true })

  return (
    <ReportPage
      paper={A4_PORTRAIT}
      back={
        <Button asChild variant="ghost" size="sm">
          <Link to="/laporan">
            <ArrowLeft />
            Laporan
          </Link>
        </Button>
      }
      summary={data ? `${data.tailors.length} penjahit · ${sheets.length} halaman` : undefined}
      fileName={`rekap-penjahit-${from}-${to}.pdf`}
      isReady={data !== undefined && sheets.length > 0}
      controls={
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="book-tailor">Penjahit</Label>
            <NativeSelect
              id="book-tailor"
              value={tailorId ?? ''}
              onChange={(event) => setSearch({ penjahit: event.target.value || undefined })}
            >
              <option value="">Semua penjahit</option>
              {tailors.data?.tailors.map((tailor) => (
                <option key={tailor.id} value={tailor.id}>
                  {tailor.code} · {tailor.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-from">Dari</Label>
            <Input
              id="book-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => event.target.value && setSearch({ dari: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-to">Sampai</Label>
            <Input
              id="book-to"
              type="date"
              value={to}
              min={from}
              onChange={(event) => event.target.value && setSearch({ sampai: event.target.value })}
            />
          </div>
        </div>
      }
    >
      {history.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(history.error))}
        </p>
      ) : !data ? (
        <div className="h-[60vh] w-full max-w-3xl animate-pulse rounded-lg bg-surface-hover" />
      ) : sheets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada gajian atau kasbon di rentang ini.
        </p>
      ) : (
        sheets.map(({ key, ...sheet }) => <BookSheet key={key} range={range} {...sheet} />)
      )}
    </ReportPage>
  )
}
