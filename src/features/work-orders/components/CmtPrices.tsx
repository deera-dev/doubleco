import { useMasterData } from '@/features/master-data/api/queries'
import type { WorkOrder } from '@/features/work-orders/api/schema'

const thousands = new Intl.NumberFormat('id-ID')

/**
 * What a CMT luar is paid per pcs for this WO: each CMT's own price for the WO's category, set
 * in Master Data. Nothing to fill in here.
 */
export function CmtPrices({ workOrder }: { workOrder: WorkOrder }) {
  const cmts = (useMasterData().data?.cmts ?? []).filter((cmt) => cmt.isActive)
  if (cmts.length === 0) return null
  const category = workOrder.category

  return (
    <div className="space-y-1 sm:col-span-2">
      <dt className="text-muted-foreground text-xs">
        Harga CMT luar / pcs{category ? ` (kategori ${category})` : ''}, untuk kartu yang dikerjakan
        CMT
      </dt>
      <dd className="flex flex-wrap gap-2">
        {cmts.map((cmt) => (
          <span
            key={cmt.id}
            className="rounded-xl border border-warning/40 bg-warning/10 px-2.5 py-1 text-sm"
          >
            <span className="font-mono font-semibold">{cmt.code}</span> {cmt.name} ·{' '}
            {category
              ? `Rp ${thousands.format(cmt.rates[category])}`
              : `S ${thousands.format(cmt.rates.S)} · M ${thousands.format(cmt.rates.M)} · L ${thousands.format(cmt.rates.L)}`}
          </span>
        ))}
      </dd>
    </div>
  )
}
