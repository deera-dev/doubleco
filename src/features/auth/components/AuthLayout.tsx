import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrandMark } from '@/features/shell/components/BrandMark'
import { cn } from '@/shared/lib/utils'

const highlightStagger = ['stagger-4', 'stagger-5', 'stagger-6']

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
  credit?: ReactNode
}

const highlights = [
  'Kartu jahit ber-QR, setor cukup sekali scan',
  'Gajian Sabtu terhitung otomatis dari setoran',
  'Kasbon, cicilan, dan sisa selalu tercatat',
]

function Wordmark() {
  return <p className="text-metal font-semibold text-sm uppercase tracking-wordmark">DoubleCo</p>
}

function BrandPanel() {
  return (
    <aside className="hero-surface relative hidden overflow-hidden rounded-3xl lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="grid-pattern pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 size-112 animate-drift rounded-full bg-brand-500/20 blur-3xl"
      />
      <div className="relative flex animate-rise items-center gap-4">
        <BrandMark className="h-10" />
        <Wordmark />
      </div>
      <div className="stagger-2 relative max-w-md animate-rise space-y-6">
        <h2 className="font-semibold text-4xl leading-tight tracking-tight xl:text-5xl">
          Produksi Maryam, <span className="text-metal">tertata rapi.</span>
        </h2>
        <ul className="space-y-3">
          {highlights.map((highlight, index) => (
            <li
              key={highlight}
              className={cn(
                'flex animate-rise items-center gap-3 text-muted-foreground',
                highlightStagger[index],
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background/50">
                <Check className="size-3.5 text-brand-200" />
              </span>
              {highlight}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-subtle-foreground text-xs">WO · Kartu jahit · Setoran · Gajian</p>
    </aside>
  )
}

export function AuthLayout({ title, description, children, footer, credit }: AuthLayoutProps) {
  return (
    <div className="grid grid-cols-1 min-h-dvh gap-4 p-4 lg:grid-cols-2 lg:p-5">
      <BrandPanel />
      <main className="flex flex-col px-2 pt-8 pb-4 sm:px-6 lg:px-10">
        <div className="stagger-1 mx-auto my-auto w-full max-w-sm animate-rise space-y-8">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <BrandMark className="h-14" />
            <Wordmark />
          </div>
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {children}
          {footer && <div className="text-center text-sm lg:text-left">{footer}</div>}
        </div>
        {credit && (
          <footer className="mt-12 text-center text-subtle-foreground text-xs">{credit}</footer>
        )}
      </main>
    </div>
  )
}
