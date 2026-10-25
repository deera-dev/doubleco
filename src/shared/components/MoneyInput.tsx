import type { ComponentProps } from 'react'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

const grouping = new Intl.NumberFormat('id-ID')

interface MoneyInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value: number | null
  onValueChange: (value: number | null) => void
}

/** Rupiah amount typed as digits and shown with thousand separators (100.000). */
export function MoneyInput({ value, onValueChange, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground text-sm">
        Rp
      </span>
      <Input
        inputMode="numeric"
        autoComplete="off"
        className={cn('h-12 pl-11 font-mono tabular-nums', className)}
        value={value === null ? '' : grouping.format(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 10)
          onValueChange(digits === '' ? null : Number(digits))
        }}
        {...props}
      />
    </div>
  )
}
