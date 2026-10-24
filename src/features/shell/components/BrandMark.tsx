import { cn } from '@/shared/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return <img src="/logo-mark.svg" alt="DoubleCo" className={cn('logo-glow w-auto', className)} />
}

export function BrandLockup({ subtitle = 'Produksi Maryam' }: { subtitle?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="h-7 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-metal truncate font-semibold text-sm tracking-tight">DoubleCo</p>
        <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
      </div>
    </div>
  )
}
