import { ImagePlus, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import {
  useRemoveWorkOrderPhoto,
  useUploadWorkOrderPhoto,
} from '@/features/work-orders/api/mutations'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { cn } from '@/shared/lib/utils'

export function SamplePhoto({ workOrder }: { workOrder: WorkOrder }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadWorkOrderPhoto()
  const remove = useRemoveWorkOrderPhoto()
  const canEdit = workOrder.status !== 'cancelled'

  const choose = () => inputRef.current?.click()

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.mutate(
      { id: workOrder.id, file },
      {
        onSuccess: () => toast.success('Foto sampel tersimpan'),
        onError: (error) => toast.error(describeError(error)),
      },
    )
  }

  const onRemove = () =>
    remove.mutate(
      { id: workOrder.id },
      {
        onSuccess: () => toast.success('Foto sampel dihapus'),
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <section className="surface stagger-2 flex animate-rise flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-semibold">Foto sampel</h2>
        <p className="text-muted-foreground text-sm">Ikut tercetak di kartu WO.</p>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-background/60',
          workOrder.photoUrl ? 'aspect-3/4' : 'aspect-video lg:aspect-3/4',
        )}
      >
        {workOrder.photoUrl ? (
          <img
            src={workOrder.photoUrl}
            alt={`Foto sampel ${workOrder.productCode}`}
            className="size-full animate-fade-in object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={choose}
            disabled={!canEdit || upload.isPending}
            className="interactive flex size-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none"
          >
            <ImagePlus className="size-7" />
            {canEdit ? 'Unggah foto sampel' : 'Belum ada foto'}
          </button>
        )}
        {upload.isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm backdrop-blur-sm">
            <LoaderCircle className="size-6 animate-spin text-brand-200" />
            Mengunggah…
          </div>
        )}
      </div>

      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={choose}
            disabled={upload.isPending || remove.isPending}
          >
            {workOrder.photoUrl ? <RefreshCw /> : <ImagePlus />}
            {workOrder.photoUrl ? 'Ganti foto' : 'Pilih foto'}
          </Button>
          {workOrder.hasPhoto && (
            <ConfirmDeleteButton
              label="Hapus foto"
              confirmLabel="Ya, hapus foto"
              onConfirm={onRemove}
              isPending={remove.isPending || upload.isPending}
            />
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={onFile}
      />
    </section>
  )
}
