/** "MIDI · HITAM" for older colour-based cut results, just "MIDI" since cutting is counted per size. */
export function itemLabel(sizeName: string, colorName: string | null): string {
  return colorName ? `${sizeName} · ${colorName}` : sizeName
}
