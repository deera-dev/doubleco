export function labelKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function findByLabel<T>(
  items: T[],
  value: string,
  labelOf: (item: T) => string,
): T | undefined {
  const key = labelKey(value)
  if (key === '') return undefined
  return items.find((item) => labelKey(labelOf(item)) === key)
}

export function suggestLabels(options: string[], query: string, limit = 8): string[] {
  const key = labelKey(query)
  if (key === '') return options.slice(0, limit)
  const starts = options.filter((option) => labelKey(option).startsWith(key))
  const contains = options.filter(
    (option) => !labelKey(option).startsWith(key) && labelKey(option).includes(key),
  )
  return [...starts, ...contains].slice(0, limit)
}
