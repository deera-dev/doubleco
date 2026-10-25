import type { WorkOrderStatus } from '@/features/work-orders/api/schema'

export const workOrderStatusMeta: Record<WorkOrderStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border-border-strong bg-muted text-muted-foreground' },
  cutting: { label: 'Dipotong', className: 'border-warning/30 bg-warning/10 text-warning' },
  sewing: { label: 'Dijahit', className: 'border-brand-400/40 bg-brand-500/15 text-brand-100' },
  done: { label: 'Selesai', className: 'border-success/30 bg-success/10 text-success' },
  cancelled: {
    label: 'Batal',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

export function formatWorkOrderDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}-${month}-${year}`
}
