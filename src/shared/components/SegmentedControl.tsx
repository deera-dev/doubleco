import { cn } from '@/shared/lib/utils'

interface SegmentedOption<Value extends string> {
  value: Value
  label: string
  count?: number
}

interface SegmentedControlProps<Value extends string> {
  value: Value
  options: SegmentedOption<Value>[]
  onChange: (value: Value) => void
  label: string
  className?: string
}

export function SegmentedControl<Value extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: SegmentedControlProps<Value>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('surface flex gap-1 overflow-x-auto rounded-2xl p-1 no-scrollbar', className)}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 font-medium text-muted-foreground text-sm transition-all duration-300 hover:text-foreground',
              isActive && 'bg-surface-hover text-foreground shadow-xs',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full bg-muted px-1.5 font-mono text-subtle-foreground text-xs tabular-nums',
                  isActive && 'text-muted-foreground',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
