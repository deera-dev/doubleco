import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ChipOption {
  id: string
  label: string
  disabled?: boolean
}

interface ChipToggleGroupProps {
  options: ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  label: string
}

export function ChipToggleGroup({ options, selected, onChange, label }: ChipToggleGroupProps) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])

  return (
    <fieldset aria-label={label} className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      {options.map((option) => {
        const isSelected = selected.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            disabled={option.disabled}
            onClick={() => toggle(option.id)}
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-full border bg-input-surface px-4 text-sm transition-all duration-200 active:scale-95 disabled:opacity-40',
              isSelected
                ? 'sheen-primary border-transparent text-primary-foreground'
                : 'text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {isSelected && <Check className="size-3.5" />}
            {option.label}
          </button>
        )
      })}
    </fieldset>
  )
}
