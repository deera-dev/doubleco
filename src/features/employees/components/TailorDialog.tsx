import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  type SaveTailorInput,
  useDeleteTailor,
  useSaveTailor,
  useSetTailorStatus,
} from '@/features/employees/api/mutations'
import {
  type Employee,
  type TailorFormInput,
  type TailorFormValues,
  tailorFormSchema,
} from '@/features/employees/api/schema'
import { useEmployeesUiStore } from '@/features/employees/store'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
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
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { confirmationWarnings } from '@/shared/lib/warnings'

const providerSuggestions = [
  'SeaBank',
  'BCA',
  'BRI',
  'BNI',
  'Mandiri',
  'BSI',
  'DANA',
  'OVO',
  'GoPay',
  'ShopeePay',
]

function defaultsFor(employee: Employee | null): TailorFormInput {
  return {
    code: employee?.code ?? '',
    name: employee?.name ?? '',
    phone: employee?.phone ?? '',
    notes: employee?.notes ?? '',
    accountType: employee?.account?.type ?? 'bank',
    accountProvider: employee?.account?.provider ?? '',
    accountNumber: employee?.account?.number ?? '',
    accountHolder: employee?.account?.holder ?? '',
  }
}

function toPayload(id: string | null, values: TailorFormValues): SaveTailorInput {
  return {
    id,
    code: values.code,
    name: values.name,
    phone: values.phone || null,
    notes: values.notes || null,
    account:
      values.accountNumber === ''
        ? null
        : {
            type: values.accountType,
            provider: values.accountProvider,
            number: values.accountNumber,
            holder: values.accountHolder.toUpperCase(),
          },
    confirmed: false,
  }
}

function StatusActions({ employee }: { employee: Employee }) {
  const openEditor = useEmployeesUiStore((state) => state.openEditor)
  const closeEditor = useEmployeesUiStore((state) => state.closeEditor)
  const setStatus = useSetTailorStatus()
  const deleteTailor = useDeleteTailor()
  const changeStatus = (status: 'active' | 'inactive') =>
    setStatus.mutate(
      { id: employee.id, status },
      {
        onSuccess: () => {
          toast.success(status === 'active' ? 'Penjahit diaktifkan' : 'Penjahit dinonaktifkan')
          closeEditor()
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )

  const remove = () =>
    deleteTailor.mutate(
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
    <div className="mt-6 space-y-2 border-t pt-5">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {employee.status === 'active' ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => changeStatus('inactive')}
            disabled={setStatus.isPending}
          >
            Nonaktifkan sementara
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => changeStatus('active')}
            disabled={setStatus.isPending}
          >
            {employee.status === 'left' ? 'Aktifkan kembali' : 'Aktifkan'}
          </Button>
        )}
        {employee.status !== 'left' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => openEditor({ kind: 'leave', employee })}
          >
            Tandai keluar
          </Button>
        )}
        <ConfirmDeleteButton
          label="Hapus penjahit"
          className="sm:col-span-2"
          onConfirm={remove}
          isPending={deleteTailor.isPending}
        />
      </div>
    </div>
  )
}

export function TailorDialog({ employee }: { employee: Employee | null }) {
  const closeEditor = useEmployeesUiStore((state) => state.closeEditor)
  const saveTailor = useSaveTailor()
  const [pending, setPending] = useState<SaveTailorInput | null>(null)
  const form = useForm<TailorFormInput, unknown, TailorFormValues>({
    resolver: zodResolver(tailorFormSchema),
    defaultValues: defaultsFor(employee),
  })

  useEffect(() => {
    form.reset(defaultsFor(employee))
  }, [employee, form])

  const accountType = form.watch('accountType')
  const warnings = confirmationWarnings(saveTailor.error)

  const submit = (payload: SaveTailorInput) =>
    saveTailor.mutate(payload, {
      onSuccess: () => {
        toast.success(employee ? 'Perubahan disimpan' : `${payload.name} ditambahkan`)
        closeEditor()
      },
      onError: (error) => {
        if (confirmationWarnings(error)) {
          setPending(payload)
          return
        }
        if (error.kind === 'business' && error.code === 'TAILOR_CODE_TAKEN') {
          form.setError('code', { message: 'Kode sudah dipakai penjahit lain' })
        }
      },
    })

  const onSubmit = form.handleSubmit((values) => submit(toPayload(employee?.id ?? null, values)))

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{employee ? `Ubah ${employee.name}` : 'Tambah penjahit'}</DialogTitle>
            <DialogDescription>
              {employee && employee.advanceBalance !== 0
                ? `Sisa kasbon ${formatRupiah(employee.advanceBalance)}`
                : 'Kode penjahit dipakai di kartu jahit dan gajian.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" className="h-12 font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
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
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. HP (opsional)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="tel"
                        className="h-12"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">Rekening gaji</p>
                  <SegmentedControl
                    label="Jenis rekening"
                    value={accountType}
                    onChange={(value) => form.setValue('accountType', value)}
                    options={[
                      { value: 'bank', label: 'Bank' },
                      { value: 'ewallet', label: 'E-wallet' },
                    ]}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="accountProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{accountType === 'bank' ? 'Bank' : 'E-wallet'}</FormLabel>
                        <FormControl>
                          <Input list="account-providers" className="h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" className="h-12 font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="accountHolder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Atas nama</FormLabel>
                      <FormControl>
                        <Input
                          autoCapitalize="characters"
                          className="h-12 uppercase placeholder:normal-case"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Boleh berbeda dengan nama penjahit.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <datalist id="account-providers">
                  {providerSuggestions.map((provider) => (
                    <option key={provider} value={provider} />
                  ))}
                </datalist>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (opsional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {saveTailor.error && !warnings && (
                <p role="alert" className="text-destructive text-sm">
                  {describeError(saveTailor.error)}
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
                  Batal
                </Button>
                <Button type="submit" size="lg" disabled={saveTailor.isPending}>
                  {saveTailor.isPending ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          {employee && <StatusActions employee={employee} />}
        </DialogContent>
      </Dialog>
      <ConfirmWarningsDialog
        warnings={pending ? warnings : null}
        isPending={saveTailor.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && submit({ ...pending, confirmed: true })}
      />
    </>
  )
}
