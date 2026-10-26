import { useNavigate } from '@tanstack/react-router'
import { Banknote, ChevronLeft, ChevronRight, Download, Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { usePayrollOverview } from '@/features/payroll/api/queries'
import type { PayrollLine, PayrollOverview } from '@/features/payroll/api/schema'
import { DeductionsPanel } from '@/features/payroll/components/DeductionsPanel'
import {
  AdditionDialog,
  LockDialog,
  RepaymentDialog,
  UnlockDialog,
} from '@/features/payroll/components/PayrollDialogs'
import { PayrollLineCard } from '@/features/payroll/components/PayrollLineCard'
import { formatPayDay, formatWeek, shiftWeeks } from '@/features/payroll/lib/dates'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import { type CsvColumn, downloadCsv } from '@/shared/lib/csv'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const transferColumns: CsvColumn<PayrollLine>[] = [
  { header: 'Kode', value: (row) => row.code },
  { header: 'Nama', value: (row) => row.name },
  { header: 'Bank/E-wallet', value: (row) => row.account?.provider ?? 'TUNAI' },
  { header: 'No. rekening', value: (row) => (row.account ? `'${row.account.number}` : null) },
  { header: 'Atas nama', value: (row) => row.account?.holder ?? null },
  { header: 'Kartu', value: (row) => row.cards.length },
  { header: 'Pcs', value: (row) => row.pieces },
  { header: 'Upah', value: (row) => row.grossWage },
  { header: 'Tambahan', value: (row) => row.additionTotal },
  { header: 'Kasbon baru', value: (row) => row.newAdvanceTotal },
  { header: 'Potongan rusak', value: (row) => row.deductionTotal },
  { header: 'Cicilan kasbon', value: (row) => row.advanceRepayment },
  { header: 'Transfer', value: (row) => row.transferAmount },
  { header: 'Status', value: (row) => (row.status === 'paid' ? 'Dibayar' : 'Belum') },
]

type Dialog =
  | { kind: 'none' }
  | { kind: 'repayment'; line: PayrollLine }
  | { kind: 'addition'; line: PayrollLine | null }
  | { kind: 'lock' }
  | { kind: 'unlock' }

/** The three things that happen every Saturday, with where this week stands. */
function Steps({ overview }: { overview: PayrollOverview }) {
  const isLocked = overview.status === 'locked'
  const allPaid = isLocked && overview.totals.paid === overview.totals.tailors
  const current = !isLocked ? 0 : allPaid ? 3 : 2
  const steps = [
    { title: 'Cek rekap', text: 'Atur cicilan kasbon, putuskan potongan' },
    { title: 'Kunci gajian', text: 'Angka dibekukan untuk transfer' },
    { title: 'Transfer', text: 'Kirim, lalu tandai dibayar' },
  ]
  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className={cn(
            'rounded-2xl border px-3 py-2.5',
            index === current
              ? 'border-brand-400/50 bg-brand-500/10'
              : index < current
                ? 'border-success/30 text-muted-foreground'
                : 'text-muted-foreground',
          )}
        >
          <p className="font-semibold text-sm">
            <span className={cn('mr-1.5 font-mono', index < current && 'text-success')}>
              {index < current ? '✓' : index + 1}
            </span>
            {step.title}
          </p>
          <p className="hidden text-muted-foreground text-xs sm:block">{step.text}</p>
        </li>
      ))}
    </ol>
  )
}

function Summary({ overview }: { overview: PayrollOverview }) {
  const stats = [
    { label: 'Total transfer', value: formatRupiah(overview.totals.transfer), emphasis: true },
    { label: 'Penjahit', value: String(overview.totals.tailors) },
    { label: 'Kartu · pcs', value: `${overview.totals.cards} · ${overview.totals.pieces}` },
    { label: 'Upah kotor', value: formatRupiah(overview.totals.grossWage) },
  ]
  return (
    <section className="stagger-1 grid animate-rise grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="surface rounded-3xl p-4 sm:p-5">
          <p className="text-muted-foreground text-xs">{stat.label}</p>
          <p
            className={cn(
              'font-mono font-semibold tabular-nums',
              stat.emphasis ? 'text-2xl text-brand-100' : 'text-xl',
            )}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </section>
  )
}

export function PayrollPage({ payOn }: { payOn: string | null }) {
  const navigate = useNavigate()
  const overview = usePayrollOverview(payOn)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  const data = overview.data
  const isLocked = data?.status === 'locked'
  const close = () => setDialog({ kind: 'none' })
  const go = (weeks: number) =>
    data && navigate({ to: '/gajian', search: { sabtu: shiftWeeks(data.payOn, weeks) } })

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Keuangan"
        title="Gajian Sabtu"
        description="Kartu yang sudah disetor otomatis terhitung. Cek, atur cicilan kasbon, lalu kunci dan transfer."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Minggu sebelumnya"
            onClick={() => go(-1)}
            disabled={!data}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-0 px-1">
            <p className="font-semibold">{data ? formatPayDay(data.payOn) : 'Memuat…'}</p>
            <p className="text-muted-foreground text-xs">
              {data ? `Setoran ${formatWeek(data.startsOn, data.payOn)}` : ''}
              {data && data.payOn === data.currentPayOn ? ' · minggu ini' : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Minggu berikutnya"
            onClick={() => go(1)}
            disabled={!data || data.isFuture}
          >
            <ChevronRight />
          </Button>
        </div>
        {data && (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs',
              isLocked
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-brand-400/40 bg-brand-500/15 text-brand-100',
            )}
          >
            {isLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            {isLocked
              ? `Dikunci · ${data.totals.paid}/${data.totals.tailors} dibayar`
              : 'Terbuka · rekap otomatis'}
          </span>
        )}
      </div>

      {overview.isPending ? (
        <ListSkeleton rows={3} />
      ) : overview.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(overview.error))}
        </p>
      ) : data ? (
        <>
          {!data.isFuture && data.lines.length > 0 && <Steps overview={data} />}
          <Summary overview={data} />
          {!isLocked && <DeductionsPanel deductions={data.pendingDeductions} />}

          {data.isFuture ? (
            <EmptyState
              icon={Banknote}
              title="Belum bisa direkap"
              description="Gajian minggu depan direkap setelah minggu ini selesai."
            />
          ) : data.lines.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Belum ada yang dibayar minggu ini"
              description="Kartu yang di-scan setor sampai hari Sabtu otomatis masuk ke sini."
            />
          ) : (
            <ul className="stagger-2 grid animate-rise grid-cols-1 gap-3 xl:grid-cols-2">
              {data.lines.map((line) => (
                <li key={line.id}>
                  <PayrollLineCard
                    line={line}
                    isLocked={isLocked}
                    onEditRepayment={() => setDialog({ kind: 'repayment', line })}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* THR and bonuses come once or twice a year, so they stay out of the weekly flow. */}
          {!data.isFuture && !isLocked && (
            <p className="text-center text-muted-foreground text-sm">
              Ada THR atau bonus minggu ini?{' '}
              <button
                type="button"
                className="font-medium text-brand-200 underline-offset-4 hover:underline"
                onClick={() => setDialog({ kind: 'addition', line: null })}
              >
                Tambahkan
              </button>
            </p>
          )}

          {!data.isFuture && (
            <div className="action-bar hide-with-keyboard sticky bottom-28 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border p-3 lg:bottom-4">
              {isLocked ? (
                <>
                  {data.totals.paid === 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={() => setDialog({ kind: 'unlock' })}
                    >
                      <LockOpen />
                      Buka kunci
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="lg"
                    onClick={() =>
                      downloadCsv(`daftar-transfer-${data.payOn}.csv`, data.lines, transferColumns)
                    }
                  >
                    <Download />
                    Daftar transfer
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  disabled={data.lines.length === 0}
                  onClick={() => setDialog({ kind: 'lock' })}
                >
                  <Lock />
                  Kunci gajian
                </Button>
              )}
            </div>
          )}

          {dialog.kind === 'repayment' && <RepaymentDialog line={dialog.line} onClose={close} />}
          {dialog.kind === 'addition' && (
            <AdditionDialog payOn={data.payOn} line={dialog.line} onClose={close} />
          )}
          {dialog.kind === 'lock' && <LockDialog overview={data} onClose={close} />}
          {dialog.kind === 'unlock' && <UnlockDialog payOn={data.payOn} onClose={close} />}
        </>
      ) : null}
    </div>
  )
}
