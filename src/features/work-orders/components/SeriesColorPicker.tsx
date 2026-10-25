import { Plus } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { ChipToggleGroup } from '@/shared/components/ChipToggleGroup'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { findByLabel, labelKey, normalizeLabel } from '@/shared/lib/labels'
import { cn } from '@/shared/lib/utils'

export const DEFAULT_SERIES = 'SERI 1'

interface SeriesOption {
  name: string
  colors: { name: string }[]
}

interface SeriesColorPickerProps {
  series: SeriesOption[]
  selectedSeries: string
  colors: string[]
  onChange: (series: string, colors: string[]) => void
}

export function SeriesColorPicker({
  series,
  selectedSeries,
  colors,
  onChange,
}: SeriesColorPickerProps) {
  const [draft, setDraft] = useState('')
  const groups = series.length > 0 ? series : [{ name: DEFAULT_SERIES, colors: [] }]
  const active =
    findByLabel(groups, selectedSeries, (group) => group.name) ?? (groups[0] as SeriesOption)
  const showHeaders = groups.length > 1

  const add = (event?: KeyboardEvent) => {
    event?.preventDefault()
    const clean = normalizeLabel(draft)
    if (labelKey(clean) === '') return
    const known = active.colors.map((color) => color.name)
    const value = findByLabel([...known, ...colors], clean, (option) => option) ?? clean
    const keep = labelKey(active.name) === labelKey(selectedSeries) ? colors : []
    if (!keep.includes(value)) onChange(active.name, [...keep, value])
    setDraft('')
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isActive = labelKey(group.name) === labelKey(selectedSeries)
        const known = group.colors.map((color) => color.name)
        const added = isActive
          ? colors.filter((value) => !findByLabel(known, value, (option) => option))
          : []
        const chips = [...known, ...added]
        return (
          <div
            key={group.name}
            className={cn(
              'space-y-2',
              showHeaders && 'rounded-2xl border p-3',
              showHeaders && isActive && 'border-brand-400/50 bg-brand-500/5',
            )}
          >
            {showHeaders && (
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {group.name}
              </p>
            )}
            {chips.length > 0 ? (
              <ChipToggleGroup
                label={`Warna ${group.name}`}
                options={chips.map((chip) => ({
                  id: chip,
                  label: added.includes(chip) ? `${chip} · baru` : chip,
                }))}
                selected={isActive ? colors : []}
                onChange={(selected) => onChange(group.name, selected)}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Belum ada warna. Tambahkan di bawah.</p>
            )}
          </div>
        )
      })}
      {showHeaders && (
        <p className="text-muted-foreground text-xs">
          Satu WO memakai satu seri. Memilih warna dari seri lain akan memindahkan pilihan.
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add(event)
          }}
          placeholder={`Warna lain${showHeaders ? ` untuk ${active.name}` : ''}`}
          aria-label="Tambah warna lain"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-12 uppercase placeholder:normal-case"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12 shrink-0"
          aria-label="Tambah warna lain"
          onClick={() => add()}
          disabled={labelKey(draft) === ''}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
