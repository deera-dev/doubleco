import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCancelCard,
  useUnsubmitCard,
  useUpdateCard,
} from '@/features/sewing-cards/api/mutations'
import { useSplitOptions } from '@/features/sewing-cards/api/queries'
import type { SewingCard } from '@/features/sewing-cards/api/schema'
import { useSewingCardsUiStore } from '@/features/sewing-cards/store'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { itemLabel } from '@/shared/lib/item-label'

function EditCardDialog({ card }: { card: SewingCard }) {
  const closeDialog = useSewingCardsUiStore((state) => state.closeDialog)
  const openDialog = useSewingCardsUiStore((state) => state.openDialog)
  const options = useSplitOptions(card.workOrderId)
  const updateCard = useUpdateCard()
  const [tailorId, setTailorId] = useState(card.tailorId ?? '')
  const [quantity, setQuantity] = useState(String(card.quantity))
  const [reason, setReason] = useState('')
  const parsedQuantity = Number(quantity)
  // The card is the bundle: changing its pcs changes the WO's cut result with it.
  const isQuantityValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0
  const isChanged = tailorId !== (card.tailorId ?? '') || parsedQuantity !== card.quantity

  const save = () =>
    updateCard.mutate(
      {
        number: card.number,
        quantity: parsedQuantity === card.quantity ? null : parsedQuantity,
        tailorId: tailorId === (card.tailorId ?? '') || tailorId === '' ? null : tailorId,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`${card.number} diperbarui. Cetak ulang kartunya.`)
          closeDialog()
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah {card.number}</DialogTitle>
          <DialogDescription>
            {card.productCode} · {itemLabel(card.sizeName, card.colorName)}. Nomor kartu dan QR
            tetap sama.
            {card.status === 'submitted' &&
              ' Sudah disetor: kalau salah penjahit, pilih yang benar, upahnya ikut pindah di gajian minggu ini.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-tailor">
              {card.status === 'submitted' ? 'Penjahit yang setor' : 'Penjahit (opsional)'}
            </Label>
            <NativeSelect
              id="card-tailor"
              value={tailorId}
              onChange={(event) => setTailorId(event.target.value)}
              disabled={!options.data}
            >
              {(!card.tailorId || !options.data) && (
                <option value={card.tailorId ?? ''}>
                  {card.tailorName ?? 'Belum dicatat — diisi saat setor'}
                </option>
              )}
              {options.data?.tailors.map((tailor) => (
                <option key={tailor.id} value={tailor.id}>
                  {tailor.code} · {tailor.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-quantity">Jumlah (pcs)</Label>
            <Input
              id="card-quantity"
              inputMode="numeric"
              className="h-12 font-mono"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ''))}
              aria-invalid={!isQuantityValid}
            />
            <p className="text-muted-foreground text-xs">
              Isi iketan sebenarnya. Hasil potong WO ikut menyesuaikan.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-reason">Alasan perubahan (opsional)</Label>
            <Textarea
              id="card-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Mis. salah tulis jumlah"
            />
          </div>
          {updateCard.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(updateCard.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <div className="flex flex-wrap gap-1 sm:mr-auto">
            {card.status === 'submitted' && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => openDialog({ kind: 'unsubmit', card })}
              >
                Batalkan setoran
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="text-destructive hover:text-destructive"
              onClick={() => openDialog({ kind: 'cancel', card })}
            >
              Batalkan kartu
            </Button>
          </div>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Tutup
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={save}
            disabled={!isChanged || !isQuantityValid || updateCard.isPending}
          >
            {updateCard.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelCardDialog({ card }: { card: SewingCard }) {
  const closeDialog = useSewingCardsUiStore((state) => state.closeDialog)
  const cancelCard = useCancelCard()
  const [reason, setReason] = useState('')

  const submit = () =>
    cancelCard.mutate(
      { number: card.number, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`${card.number} dibatalkan`)
          closeDialog()
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan {card.number}?</DialogTitle>
          <DialogDescription>
            Iketan {card.quantity} pcs {itemLabel(card.sizeName, card.colorName)}{' '}
            {card.tailorName ? `milik ${card.tailorName} ` : ''}keluar dari hasil potong WO
            {card.status === 'submitted' ? ' dan upahnya keluar dari gajian minggu ini' : ''}. Kartu
            fisiknya jangan dipakai lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="card-cancel-reason">Alasan</Label>
          <Textarea
            id="card-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. salah pilih penjahit"
          />
          {cancelCard.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(cancelCard.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Kembali
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={submit}
            disabled={cancelCard.isPending || reason.trim() === ''}
          >
            {cancelCard.isPending ? 'Memproses…' : 'Batalkan kartu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaidCardDialog({ card }: { card: SewingCard }) {
  const closeDialog = useSewingCardsUiStore((state) => state.closeDialog)
  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card.number} sudah dibayar</DialogTitle>
          <DialogDescription>
            Kartu ini masuk gajian yang sudah dikunci. Buka kunci gajian minggu itu dulu, lalu
            kartunya bisa diubah, dibatalkan setorannya, atau dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Tutup
          </Button>
          <Button asChild size="lg">
            <Link to="/gajian" onClick={closeDialog}>
              Ke Gajian
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnsubmitCardDialog({ card }: { card: SewingCard }) {
  const closeDialog = useSewingCardsUiStore((state) => state.closeDialog)
  const unsubmit = useUnsubmitCard()
  const [reason, setReason] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan setoran {card.number}?</DialogTitle>
          <DialogDescription>
            Kartu kembali ke status di penjahit{card.tailorName ? ` (${card.tailorName})` : ''} dan
            upahnya keluar dari gajian minggu ini. Pakai kalau kartu ter-scan padahal belum disetor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="card-unsubmit-reason">Alasan</Label>
          <Textarea
            id="card-unsubmit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Mis. salah scan"
          />
          {unsubmit.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(unsubmit.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={closeDialog}>
            Kembali
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={unsubmit.isPending || reason.trim() === ''}
            onClick={() =>
              unsubmit.mutate(
                { number: card.number, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(`Setoran ${card.number} dibatalkan`)
                    closeDialog()
                  },
                },
              )
            }
          >
            {unsubmit.isPending ? 'Memproses…' : 'Batalkan setoran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CardDialogs() {
  const dialog = useSewingCardsUiStore((state) => state.dialog)
  if (dialog.kind === 'edit' && dialog.card.status === 'paid')
    return <PaidCardDialog key={dialog.card.id} card={dialog.card} />
  if (dialog.kind === 'edit') return <EditCardDialog key={dialog.card.id} card={dialog.card} />
  if (dialog.kind === 'unsubmit')
    return <UnsubmitCardDialog key={dialog.card.id} card={dialog.card} />
  if (dialog.kind === 'cancel') return <CancelCardDialog key={dialog.card.id} card={dialog.card} />
  return null
}
