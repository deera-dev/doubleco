import { ArrowUpRight, ScanLine } from 'lucide-react'
import { announceSoon } from '@/features/shell/components/NavigationEntry'
import {
  formatLongDate,
  formatShortDate,
  greetingFor,
  paydayInfo,
  workdays,
} from '@/features/shell/lib/calendar'
import { moduleItems, type NavigationItem, scanItem } from '@/features/shell/navigation'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const staggerClasses = [
  'stagger-1',
  'stagger-2',
  'stagger-3',
  'stagger-4',
  'stagger-5',
  'stagger-6',
]

function ScanHero() {
  return (
    <section className="hero-surface stagger-1 relative animate-rise overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-2">
      <div className="grid-pattern pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 size-80 animate-drift rounded-full bg-brand-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -bottom-12 hidden size-72 sm:block"
      >
        <ScanLine strokeWidth={1} className="size-full text-brand-200/10" />
        <div className="absolute inset-x-12 top-1/2 h-px animate-scan bg-brand-200/60 shadow-lg shadow-brand-400" />
      </div>
      <div className="relative flex h-full flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-border-strong bg-background/40 px-3 py-1 font-medium text-brand-100 text-xs">
            Aksi utama
          </span>
          <span className="text-muted-foreground text-xs">Segera hadir</span>
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="font-semibold text-2xl tracking-tight sm:text-3xl">Scan kartu jahit</h2>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
            Setor, periksa, dan langsung terhitung ke gajian Sabtu. Cukup sekali scan, tanpa catat
            ulang di Excel.
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => announceSoon(scanItem)}
          >
            <ScanLine />
            Mulai scan
          </Button>
        </div>
      </div>
    </section>
  )
}

function PaydayCard({ today }: { today: Date }) {
  const { payday, daysUntil, workdayIndex } = paydayInfo(today)
  const headline = daysUntil === 0 ? 'Hari ini' : `${daysUntil} hari lagi`

  return (
    <section className="surface stagger-2 flex animate-rise flex-col gap-6 rounded-3xl p-6 sm:p-8">
      <div className="space-y-1">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Gajian berikutnya
        </p>
        <p className="text-metal font-semibold text-4xl tracking-tight">{headline}</p>
        <p className="text-muted-foreground text-sm capitalize">{formatShortDate(payday)}</p>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Kartu yang di-scan saat setor langsung masuk rekap gajian. Tidak perlu scan ulang di hari
        Sabtu.
      </p>
      <div className="mt-auto space-y-2">
        <div className="grid grid-cols-6 gap-1.5">
          {workdays.map((day, index) => (
            <div key={day.key} className="h-1.5 overflow-hidden rounded-full bg-border-strong">
              <div
                className={cn(
                  'h-full origin-left animate-fill rounded-full',
                  staggerClasses[index],
                  workdayIndex !== null && index < workdayIndex && 'bg-metal-500',
                  index === workdayIndex && 'sheen-primary',
                  (workdayIndex === null || index > workdayIndex) && 'hidden',
                )}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-subtle-foreground text-xs">
          {workdays.map((day, index) => (
            <span key={day.key} className={cn(index === workdayIndex && 'text-foreground')}>
              {day.initial}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function ModuleRow({ item, index }: { item: NavigationItem; index: number }) {
  return (
    <li className={cn('animate-rise', staggerClasses[index])}>
      <button
        type="button"
        onClick={() => announceSoon(item)}
        className="surface interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left hover:bg-surface-hover"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-background/60 text-metal-200 transition-colors duration-300 group-hover:border-brand-400/50 group-hover:text-brand-100">
          <item.icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-sm">{item.title}</span>
          <span className="block truncate text-muted-foreground text-sm">{item.description}</span>
        </span>
        <span className="hidden rounded-full border px-2.5 py-0.5 text-subtle-foreground text-xs sm:inline">
          Segera
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
    </li>
  )
}

export function HomeDashboard({ displayName, now }: { displayName: string; now: Date }) {
  return (
    <div className="space-y-10">
      <header className="animate-rise space-y-2">
        <p className="text-muted-foreground text-sm capitalize">{formatLongDate(now)}</p>
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          {greetingFor(now)}, <span className="text-metal">{displayName}</span>
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ScanHero />
        <PaydayCard today={now} />
      </div>

      <section className="stagger-3 animate-rise space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-lg tracking-tight">Modul</h2>
          <p className="text-muted-foreground text-sm">
            {moduleItems.length} modul sedang disiapkan
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {moduleItems.map((item, index) => (
            <ModuleRow key={item.title} item={item} index={index} />
          ))}
        </ul>
      </section>
    </div>
  )
}
