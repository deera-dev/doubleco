import type { CardStatus } from '@/features/sewing-cards/api/schema'

export const cardStatusMeta: Record<CardStatus, { label: string; className: string }> = {
  taken: { label: 'Di penjahit', className: 'border-brand-400/40 bg-brand-500/15 text-brand-100' },
  submitted: { label: 'Disetor', className: 'border-success/30 bg-success/10 text-success' },
  paid: { label: 'Dibayar', className: 'border-border-strong bg-muted text-muted-foreground' },
  cancelled: {
    label: 'Batal',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

export function cardPrintSearch(numbers: string[]): { nomor: string } {
  return { nomor: numbers.join(',') }
}

export function parseCardNumbers(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter((part) => /^KJ-\d{4}-\d{4,}$/.test(part)),
    ),
  ]
}
