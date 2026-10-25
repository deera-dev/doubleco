import logoUrl from '@/assets/maryam-production.svg'
import { cn } from '@/shared/lib/utils'

/** MARYAM PRODUCTION mark. Required at the top-left of every printed card (WO and sewing card). */
export function MaryamLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Maryam Production"
      className={cn('block w-auto shrink-0 object-contain', className)}
    />
  )
}
