import { ChevronRight, Scissors } from 'lucide-react'
import type { Employee } from '@/features/employees/api/schema'
import { Avatar } from '@/features/shell/components/UserMenu'
import { formatIsoDate, formatRupiah, maskAccountNumber } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const statusStyles: Record<Employee['status'], { label: string; className: string }> = {
  active: { label: 'Aktif', className: 'border-success/30 bg-success/10 text-success' },
  inactive: {
    label: 'Tidak aktif',
    className: 'border-border-strong bg-muted text-muted-foreground',
  },
}

function subtitleOf(employee: Employee): string {
  if (employee.status === 'inactive' && employee.purgeOn) {
    return `Terhapus otomatis ${formatIsoDate(employee.purgeOn)}`
  }
  if (employee.type === 'cutter') return 'Tukang potong'
  if (employee.account) {
    return `${employee.account.provider} ${maskAccountNumber(employee.account.number)}`
  }
  return 'Rekening belum diisi'
}

export function EmployeeRow({ employee, onSelect }: { employee: Employee; onSelect: () => void }) {
  const status = statusStyles[employee.status]

  return (
    <button
      type="button"
      onClick={onSelect}
      className="surface interactive group flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left hover:bg-surface-hover sm:gap-4 sm:p-4"
    >
      {employee.type === 'cutter' ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background/60 text-metal-200">
          <Scissors className="size-4" />
        </span>
      ) : (
        <Avatar name={employee.name} className={cn(employee.status !== 'active' && 'opacity-60')} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{employee.name}</span>
          {employee.code && (
            <span className="shrink-0 rounded-md border px-1.5 font-mono text-muted-foreground text-xs">
              #{employee.code}
            </span>
          )}
        </span>
        <span
          className={cn(
            'block truncate text-muted-foreground text-xs',
            ((employee.type === 'tailor' && !employee.account) || employee.status === 'inactive') &&
              'text-warning',
          )}
        >
          {subtitleOf(employee)}
        </span>
      </span>
      {employee.advanceBalance !== 0 && (
        <span className="hidden text-right sm:block">
          <span className="block text-subtle-foreground text-xs">Sisa kasbon</span>
          <span className="block font-medium font-mono text-sm tabular-nums">
            {formatRupiah(employee.advanceBalance)}
          </span>
        </span>
      )}
      <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs', status.className)}>
        {status.label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
