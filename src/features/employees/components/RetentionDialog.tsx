import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useSetRetentionDays } from '@/features/employees/api/mutations'
import {
  type RetentionFormInput,
  type RetentionFormValues,
  retentionFormSchema,
} from '@/features/employees/api/schema'
import { useEmployeesUiStore } from '@/features/employees/store'
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

export function RetentionDialog({ days }: { days: number }) {
  const closeEditor = useEmployeesUiStore((state) => state.closeEditor)
  const setRetention = useSetRetentionDays()
  const form = useForm<RetentionFormInput, unknown, RetentionFormValues>({
    resolver: zodResolver(retentionFormSchema),
    defaultValues: { days: String(days) },
  })

  const onSubmit = form.handleSubmit((values) =>
    setRetention.mutate(values, {
      onSuccess: () => {
        toast.success(`Hapus otomatis setelah ${values.days} hari tidak aktif`)
        closeEditor()
      },
    }),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus otomatis karyawan tidak aktif</DialogTitle>
          <DialogDescription>
            Karyawan yang tidak aktif melewati batas ini dihapus dari daftar secara otomatis.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batas tidak aktif (hari)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" className="h-12 font-mono" {...field} />
                  </FormControl>
                  <FormDescription>
                    Yang sudah punya kartu, kasbon, atau gajian tetap disimpan untuk riwayat dan
                    laporan, hanya disembunyikan. Sisa kasbon dicatat sebagai kerugian.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {setRetention.error && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(setRetention.error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={setRetention.isPending}>
                {setRetention.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
