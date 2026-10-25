import { Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { useSewingCards } from '@/features/sewing-cards/api/queries'
import { CardDialogs } from '@/features/sewing-cards/components/CardDialogs'
import { CardRow } from '@/features/sewing-cards/components/CardRow'
import { cardPrintSearch } from '@/features/sewing-cards/lib/status'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

export function WorkOrderCards({ workOrderId }: { workOrderId: string }) {
  const cards = useSewingCards({ status: 'all', search: '', workOrderId })
  const list = cards.data?.cards ?? []
  const openNumbers = list.filter((card) => card.status === 'taken').map((card) => card.number)

  return (
    <section className="surface stagger-3 animate-rise space-y-5 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-semibold">Kartu jahit</h2>
          <p className="text-muted-foreground text-sm">
            {list.length > 0
              ? `${list.length} kartu · ${openNumbers.length} masih di penjahit.`
              : 'Belum ada kartu. Isi hasil potong, lalu tekan “Buat & cetak kartu”.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {openNumbers.length > 0 && (
            <Button asChild variant="outline">
              <Link to="/cetak/kartu-jahit" search={cardPrintSearch(openNumbers)}>
                <Printer />
                Cetak {openNumbers.length} kartu
              </Link>
            </Button>
          )}
        </div>
      </div>
      {cards.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(cards.error))}
        </p>
      ) : (
        list.length > 0 && (
          <ul className="grid grid-cols-1 gap-2">
            {list.map((card) => (
              <li key={card.id}>
                <CardRow card={card} showWorkOrder={false} />
              </li>
            ))}
          </ul>
        )
      )}
      <CardDialogs />
    </section>
  )
}
