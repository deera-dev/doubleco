import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useAddWageRate } from '@/features/master-data/api/mutations'
import {
  type WageRateFormInput,
  type WageRateFormValues,
  wageRateFormSchema,
} from '@/features/master-data/api/schema'
import { useMasterDataUiStore } from '@/features/master-data/store'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah, todayIsoDate } from '@/shared/lib/format'

export function WageRateDialog() {
  const closeEditor = useMasterDataUiStore((state) => state.closeEditor)
  const addRate = useAddWageRate()
  const form = useForm<WageRateFormInput, unknown, WageRateFormValues>({
    resolver: zodResolver(wageRateFormSchema),
    defaultValues: { category: 'S', amount: '', effectiveFrom: todayIsoDate() },
  })
  const category = form.watch('category')

  const onSubmit = form.handleSubmit((values) =>
    addRate.mutate(values, {
      onSuccess: () => {
        toast.success(`Tarif ${values.category} ${formatRupiah(values.amount)} disimpan`)
        closeEditor()
      },
      onError: (error) => {
        if (error.kind === 'business' && error.code === 'DUPLICATE') {
          form.setError('effectiveFrom', { message: 'Sudah ada tarif di tanggal ini' })
        }
      },
    }),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tarif upah baru</DialogTitle>
          <DialogDescription>
            Tarif lama tetap tersimpan. Kartu jahit memakai tarif yang berlaku saat kartu dibuat.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormItem>
              <FormLabel>Kategori</FormLabel>
              <SegmentedControl
                label="Kategori"
                value={category}
                onChange={(value) => form.setValue('category', value)}
                options={[
                  { value: 'S', label: 'S' },
                  { value: 'M', label: 'M' },
                  { value: 'L', label: 'L' },
                ]}
                className="w-fit"
              />
            </FormItem>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upah per potong (Rp)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="20000"
                      className="h-12 font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Berlaku mulai</FormLabel>
                  <FormControl>
                    <Input type="date" className="h-12" {...field} />
                  </FormControl>
                  <FormDescription>Tarif yang belum berlaku masih bisa dihapus.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {addRate.error && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(addRate.error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={addRate.isPending}>
                {addRate.isPending ? 'Menyimpan…' : 'Simpan tarif'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
