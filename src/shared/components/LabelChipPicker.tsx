import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ChipToggleGroup } from '@/shared/components/ChipToggleGroup'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { findByLabel, labelKey, normalizeLabel } from '@/shared/lib/labels'

interface LabelChipPickerProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  addPlaceholder: string
  invalid?: boolean
}

export function LabelChipPicker({
  label,
  options,
  selected,
  onChange,
  addPlaceholder,
  invalid,
}: LabelChipPickerProps) {
  const [draft, setDraft] = useState('')
  const added = selected.filter((value) => !findByLabel(options, value, (option) => option))
  const chips = [...options, ...added]

  const add = (event?: FormEvent) => {
    event?.preventDefault()
    const clean = normalizeLabel(draft)
    if (labelKey(clean) === '') return
    const value = findByLabel(chips, clean, (option) => option) ?? clean
    if (!selected.includes(value)) onChange([...selected, value])
    setDraft('')
  }

  return (
    <div className="space-y-4">
      {chips.length > 0 && (
        <ChipToggleGroup
          label={label}
          options={chips.map((chip) => ({
            id: chip,
            label: added.includes(chip) ? `${chip} · baru` : chip,
          }))}
          selected={selected}
          onChange={onChange}
        />
      )}
      <div className="flex gap-2 pt-1">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add(event)
          }}
          placeholder={addPlaceholder}
          aria-label={addPlaceholder}
          aria-invalid={invalid || undefined}
          autoCapitalize="characters"
          autoComplete="off"
          className="h-12 uppercase placeholder:normal-case"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-12 shrink-0"
          aria-label={addPlaceholder}
          onClick={() => add()}
          disabled={labelKey(draft) === ''}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
