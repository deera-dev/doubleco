import { SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { cn } from '@/shared/lib/utils'

export interface FilterDefinition {
  key: string
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
}

/** A "Filter" button that opens a row of selects; active filters stay visible as removable chips. */
export function FilterBar({ filters }: { filters: FilterDefinition[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const active = filters.filter((filter) => filter.value !== null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={active.length > 0 ? 'secondary' : 'outline'}
          size="sm"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <SlidersHorizontal />
          Filter{active.length > 0 ? ` (${active.length})` : ''}
        </Button>
        {active.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => filter.onChange(null)}
            className="flex h-8 items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/10 pr-2 pl-3 text-brand-100 text-xs"
            aria-label={`Hapus filter ${filter.label}`}
          >
            {filter.label}:{' '}
            {filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}
            <X className="size-3.5" />
          </button>
        ))}
        {active.length > 1 && (
          <button
            type="button"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            onClick={() => {
              for (const filter of active) filter.onChange(null)
            }}
          >
            Hapus semua
          </button>
        )}
      </div>
      {isOpen && (
        <div
          className={cn(
            'grid animate-rise gap-3 rounded-2xl border bg-background/40 p-3',
            filters.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
        >
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-1.5">
              <Label htmlFor={`filter-${filter.key}`} className="text-xs">
                {filter.label}
              </Label>
              <NativeSelect
                id={`filter-${filter.key}`}
                value={filter.value ?? ''}
                onChange={(event) => filter.onChange(event.target.value || null)}
                className="h-11"
              >
                <option value="">Semua</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
