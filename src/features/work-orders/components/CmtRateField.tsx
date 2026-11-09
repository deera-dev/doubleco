import { Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useSetCmtRate } from '@/features/work-orders/api/mutations'
import type { WorkOrder } from '@/features/work-orders/api/schema'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { describeError } from '@/shared/lib/error-messages'

const thousands = new Intl.NumberFormat('id-ID')

/** Price per pcs for a CMT luar on this WO. CMT cards stay out of the Saturday payroll. */
export function CmtRateField({ workOrder }: { workOrder: WorkOrder }) {
  const setRate = useSetCmtRate()
  const saved = workOrder.cmtRate === null ? '' : thousands.format(workOrder.cmtRate)
  const [text, setText] = useState(saved)
  const digits = text.replace(/\D/g, '')
  const rate = digits === '' ? null : Number(digits)
  const isChanged = rate !== workOrder.cmtRate
  const isValid = rate === null || (rate > 0 && rate <= 10_000_000)

  const save = () =>
    setRate.mutate(
      { id: workOrder.id, rate },
      {
        onSuccess: () => toast.success(rate ? 'Harga CMT disimpan' : 'Harga CMT dihapus'),
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor="cmt-rate" className="text-muted-foreground text-xs">
        Harga CMT luar / pcs
      </Label>
      <div className="flex gap-2">
        <div className="relative max-w-56 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <Input
            id="cmt-rate"
            inputMode="numeric"
            value={text}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '')
              setText(next === '' ? '' : thousands.format(Number(next)))
            }}
            placeholder="Belum diisi"
            aria-invalid={!isValid}
            className="h-11 pl-9 font-mono tabular-nums"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={!isChanged || !isValid || setRate.isPending}
          onClick={save}
        >
          <Save />
          {setRate.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Dipakai kalau kartu WO ini dijahit CMT luar. Tidak masuk gajian, hanya tercatat di THP.
      </p>
    </div>
  )
}
