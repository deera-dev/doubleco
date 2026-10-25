import { Keyboard, OctagonAlert, ScanLine } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { QrScanner } from '@/features/scan/components/QrScanner'
import { ScannedCardPanel } from '@/features/scan/components/ScannedCardPanel'
import { normalizeCardNumber } from '@/features/scan/lib/card-number'
import { signal } from '@/features/scan/lib/feedback'
import { useScannedCard, useScanOptions, useSewingCards } from '@/features/sewing-cards/api/queries'
import { CardDialogs } from '@/features/sewing-cards/components/CardDialogs'
import { CardRow } from '@/features/sewing-cards/components/CardRow'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

/**
 * A card stays in front of the camera after it is handled. The camera ignores that value while it
 * keeps seeing it, and only takes it again once it has been out of view this long.
 */
const OUT_OF_VIEW_MS = 4000

function ManualEntry({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [text, setText] = useState('')
  const number = normalizeCardNumber(text)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!number) return
    onSubmit(number)
    setText('')
  }

  return (
    <form onSubmit={submit} noValidate className="flex gap-2">
      <div className="relative flex-1">
        <Keyboard className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Atau ketik nomor kartu, mis. 2610-0042"
          aria-label="Nomor kartu"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          className="h-12 pl-10 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
      </div>
      <Button type="submit" size="lg" variant="outline" disabled={!number}>
        Buka
      </Button>
    </form>
  )
}

function TodayDeposits({ today }: { today: string }) {
  const cards = useSewingCards({
    status: 'all',
    search: '',
    workOrderId: null,
    submittedOn: today,
  })
  const list = cards.data?.cards ?? []
  const pieces = list.reduce((sum, card) => sum + card.quantity, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Setoran hari ini
        </h2>
        {list.length > 0 && (
          <p className="text-muted-foreground text-sm">
            <span className="font-mono font-semibold text-foreground">{list.length}</span> kartu ·{' '}
            <span className="font-mono font-semibold text-foreground">{pieces}</span> pcs
          </p>
        )}
      </div>
      {cards.isPending ? (
        <ListSkeleton rows={2} />
      ) : cards.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(cards.error))}
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Belum ada kartu yang disetor hari ini.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {list.map((card) => (
            <li key={card.id}>
              <CardRow card={card} />
            </li>
          ))}
        </ul>
      )}
      <CardDialogs />
    </section>
  )
}

export function ScanPage() {
  const options = useScanOptions()
  const [number, setNumber] = useState<string | null>(null)
  const [notCard, setNotCard] = useState<string | null>(null)
  const scanned = useScannedCard(number)
  const lastHandled = useRef<{ value: string; at: number } | null>(null)
  const signalled = useRef<string | null>(null)

  const fromCamera = (value: string) => {
    const now = Date.now()
    const last = lastHandled.current
    const key = normalizeCardNumber(value) ?? value
    if (last && last.value === key && now - last.at < OUT_OF_VIEW_MS) {
      last.at = now
      return
    }
    lastHandled.current = { value: key, at: now }
    open(value)
  }

  const open = (value: string) => {
    const card = normalizeCardNumber(value)
    if (!card) {
      setNotCard(value)
      signal('blocked')
      return
    }
    setNotCard(null)
    signalled.current = null
    setNumber(card)
  }

  const reset = () => {
    if (number) lastHandled.current = { value: number, at: Date.now() }
    setNumber(null)
    setNotCard(null)
  }

  useEffect(() => {
    if (!number || signalled.current === number) return
    if (scanned.data?.number === number) {
      signalled.current = number
      signal(scanned.data.status === 'taken' ? 'found' : 'blocked')
    } else if (scanned.isError) {
      signalled.current = number
      signal('blocked')
    }
  }, [number, scanned.data, scanned.isError])

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Setoran"
        title="Scan Kartu"
        description="Scan QR kartu jahit saat penjahit setor. Kartu yang disetor otomatis masuk gajian Sabtu."
      />

      {number === null ? (
        <section className="stagger-1 animate-rise space-y-3">
          <div className="mx-auto max-w-xl">
            <QrScanner onDetect={fromCamera} paused={false} />
          </div>
          <div className="mx-auto max-w-xl">
            <ManualEntry onSubmit={open} />
          </div>
          {notCard && (
            <p
              role="alert"
              className="mx-auto flex max-w-xl items-center gap-2 text-destructive text-sm"
            >
              <OctagonAlert className="size-4 shrink-0" />
              QR ini bukan kartu jahit.
            </p>
          )}
        </section>
      ) : scanned.isPending || options.isPending ? (
        <ListSkeleton rows={2} />
      ) : scanned.isError || options.isError ? (
        <section className="surface animate-rise space-y-4 rounded-3xl border-destructive/50 p-5 sm:p-6">
          <div className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <OctagonAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="space-y-1 text-sm">
              <p className="font-mono font-semibold">{number}</p>
              <p className="text-destructive">
                {describeError(toAppError(scanned.error ?? options.error))}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="lg" onClick={reset}>
              <ScanLine />
              Scan kartu lain
            </Button>
          </div>
        </section>
      ) : (
        <ScannedCardPanel
          key={scanned.data.number}
          card={scanned.data}
          tailors={options.data.tailors}
          today={options.data.today}
          onDone={reset}
        />
      )}

      {options.data && <TodayDeposits today={options.data.today} />}
    </div>
  )
}
