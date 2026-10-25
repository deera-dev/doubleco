import { cn } from '@/shared/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-input bg-input-surface px-4 py-3 text-left disabled:opacity-50"
    >
      <span className="space-y-0.5">
        <span className="block font-medium text-sm">{label}</span>
        {description && <span className="block text-muted-foreground text-xs">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border border-border-strong bg-muted transition-colors duration-300',
          checked && 'sheen-primary border-transparent',
        )}
      >
        <span
          className={cn(
            'sheen-metal absolute top-0.5 left-0.5 size-4.5 rounded-full transition-transform duration-300 ease-out',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

export { Switch }
