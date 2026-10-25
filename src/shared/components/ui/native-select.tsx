import { ChevronDown } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/shared/lib/utils'

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'flex h-12 w-full appearance-none rounded-xl border border-input bg-input-surface px-3 pr-10 text-base text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50 aria-invalid:border-destructive md:text-sm [&>option]:bg-popover',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
