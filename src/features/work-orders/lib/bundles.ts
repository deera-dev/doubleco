/** "12 9 11" or "12,9" → [12, 9, 11]; bundles hold different amounts, typed one after another. */
export function parseBundles(text: string): number[] {
  return text
    .split(/[^0-9]+/)
    .filter((part) => part !== '')
    .map(Number)
    .filter((value) => value > 0 && value <= 10_000)
}
