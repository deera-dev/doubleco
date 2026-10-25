import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useDeleteCutter, useSaveCutter } from '@/features/employees/api/mutations'
import {
  type CutterFormInput,
  type CutterFormValues,
  cutterFormSchema,
  type Employee,
} from '@/features/employees/api/schema'
import { useEmployeesUiStore } from '@/features/employees/store'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { describeError } from '@/shared/lib/error-messages'

export function CutterDialog({ employee }: { employee: Employee | null }) {
  const closeEditor = useEmployeesUiStore((state) => state.closeEditor)
  const saveCutter = useSaveCutter()
  const deleteCutter = useDeleteCutter()
  const [isActive, setIsActive] = useState(employee?.status !== 'inactive')
  const form = useForm<CutterFormInput, unknown, CutterFormValues>({
    resolver: zodResolver(cutterFormSchema),
    defaultValues: { name: employee?.name ?? '' },
  })

  const onSubmit = form.handleSubmit(({ name }) =>
    saveCutter.mutate(
      { id: employee?.id ?? null, name, isActive },
      {
        onSuccess: () => {
          toast.success(employee ? 'Perubahan disimpan' : `${name} ditambahkan`)
          closeEditor()
        },
      },
    ),
  )

  const remove = () =>
    employee &&
    deleteCutter.mutate(
      { id: employee.id },
      {
        onSuccess: () => {
          toast.success(`${employee.name} dihapus`)
          closeEditor()
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? `Ubah ${employee.name}` : 'Tambah tukang potong'}</DialogTitle>
          <DialogDescription>
            Nama tukang potong muncul di kartu WO dan kartu jahit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input
                      autoCapitalize="characters"
                      className="h-12 uppercase placeholder:normal-case"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              label="Aktif"
              description="Yang tidak aktif tidak muncul saat membuat WO dan terhapus otomatis setelah masa tidak aktif."
            />
            {saveCutter.error && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(saveCutter.error)}
              </p>
            )}
            <DialogFooter>
              {employee && (
                <ConfirmDeleteButton
                  label="Hapus"
                  className="sm:mr-auto"
                  onConfirm={remove}
                  isPending={deleteCutter.isPending}
                />
              )}
              <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={saveCutter.isPending}>
                {saveCutter.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
