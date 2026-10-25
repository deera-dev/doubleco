import { Plus } from 'lucide-react'
import { type ComponentProps, type KeyboardEvent, useId, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { findByLabel, normalizeLabel, suggestLabels } from '@/shared/lib/labels'
import { cn } from '@/shared/lib/utils'

export interface ComboboxOption {
  label: string
  hint?: string
}

interface ComboboxProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  newHint?: string
}

export function Combobox({
  value,
  onValueChange,
  options,
  newHint,
  className,
  onBlur,
  disabled,
  ...props
}: ComboboxProps) {
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const labels = options.map((option) => option.label)
  const suggestions = suggestLabels(labels, value)
  const exact = findByLabel(labels, value, (label) => label)
  const isNew = value.trim() !== '' && !exact && newHint !== undefined
  const showList = isOpen && suggestions.length > 0 && !disabled

  const choose = (label: string) => {
    onValueChange(label)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && showList && activeIndex >= 0) {
      event.preventDefault()
      const label = suggestions[activeIndex]
      if (label) choose(label)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={cn('h-12 uppercase placeholder:normal-case', className)}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onValueChange(event.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={(event) => {
          setIsOpen(false)
          if (value.trim() !== '') onValueChange(exact ?? normalizeLabel(value))
          onBlur?.(event)
        }}
        onKeyDown={onKeyDown}
        {...props}
      />
      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-64 animate-fade-in overflow-y-auto rounded-2xl border border-border-strong bg-popover p-1.5 shadow-2xl"
        >
          {suggestions.map((label, index) => {
            const option = options.find((candidate) => candidate.label === label)
            return (
              <button
                key={label}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(label)}
                className={cn(
                  'flex w-full cursor-pointer items-center text-left justify-between gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-hover',
                  index === activeIndex && 'bg-surface-hover',
                  label === exact && 'text-brand-100',
                )}
              >
                <span className="truncate font-medium">{label}</span>
                {option?.hint && (
                  <span className="shrink-0 text-muted-foreground text-xs">{option.hint}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {isNew && !showList && (
        <p className="mt-1.5 flex items-center gap-1.5 text-brand-200 text-xs">
          <Plus className="size-3.5" />
          {newHint}
        </p>
      )}
    </div>
  )
}
