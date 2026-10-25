import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  useCreateWorkOrder,
  useUpdateWorkOrder,
  type WorkOrderPayload,
} from '@/features/work-orders/api/mutations'
import { useNumberSuggestion, useWorkOrderFormOptions } from '@/features/work-orders/api/queries'
import {
  type FormOptions,
  type WorkOrder,
  type WorkOrderFormInput,
  type WorkOrderFormValues,
  workOrderFormSchema,
} from '@/features/work-orders/api/schema'
import { ChipToggleGroup } from '@/shared/components/ChipToggleGroup'
import { ConfirmWarningsDialog } from '@/shared/components/ConfirmWarningsDialog'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
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
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { todayIsoDate } from '@/shared/lib/format'
import { confirmationWarnings } from '@/shared/lib/warnings'
import { toAppError } from '@/shared/types/errors'

function defaultsFor(workOrder: WorkOrder | null): WorkOrderFormInput {
  return {
    number: workOrder?.number ?? '',
    orderedOn: workOrder?.orderedOn ?? todayIsoDate(),
    productId: workOrder?.productId ?? '',
    fabricId: workOrder?.fabricId ?? '',
    cutterId: workOrder?.cutterId ?? '',
    patternCode: workOrder?.patternCode ?? '',
    fabricCombination: workOrder?.fabricCombination ?? '',
    changeStatus: workOrder?.changeStatus ?? 'follow_sample',
    changeNotes: workOrder?.changeNotes ?? '',
    additionalInfo: workOrder?.additionalInfo ?? '',
    sizeIds: [],
    colorIds: [],
  }
}

function toPayload(values: WorkOrderFormValues): WorkOrderPayload {
  return {
    number: values.number.toUpperCase(),
    orderedOn: values.orderedOn,
    productId: values.productId,
    fabricId: values.fabricId,
    cutterId: values.cutterId,
    patternCode: values.patternCode.toUpperCase() || null,
    fabricCombination: values.fabricCombination.toUpperCase() || null,
    changeStatus: values.changeStatus,
    changeNotes: values.changeStatus === 'changed' ? values.changeNotes : null,
    additionalInfo: values.additionalInfo || null,
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface space-y-4 rounded-3xl p-5 sm:p-6">
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </section>
  )
}

function useSuggestedNumber(
  form: UseFormReturn<WorkOrderFormInput, unknown, WorkOrderFormValues>,
  isCreating: boolean,
) {
  const productId = form.watch('productId')
  const suggestion = useNumberSuggestion(productId, isCreating)
  const suggested = suggestion.data?.number

  useEffect(() => {
    if (suggested && !form.getFieldState('number').isDirty) {
      form.setValue('number', suggested)
    }
  }, [suggested, form])
}

function FormFields({
  form,
  options,
  workOrder,
}: {
  form: UseFormReturn<WorkOrderFormInput, unknown, WorkOrderFormValues>
  options: FormOptions
  workOrder: WorkOrder | null
}) {
  const fabricId = form.watch('fabricId')
  const changeStatus = form.watch('changeStatus')
  const sizeIds = form.watch('sizeIds')
  const colorIds = form.watch('colorIds')
  const fabric = options.fabrics.find((candidate) => candidate.id === fabricId)
  const isLocked = workOrder?.hasCards ?? false
  const missingCategory = options.products.find(
    (product) => product.id === form.watch('productId') && product.category === null,
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Produk & potong">
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kode produk</FormLabel>
              <FormControl>
                <NativeSelect {...field} disabled={isLocked}>
                  <option value="">Pilih produk</option>
                  {options.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code}
                      {product.category ? ` · ${product.category}` : ' · kategori belum diisi'}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              {missingCategory && (
                <FormDescription className="text-warning">
                  Isi kategori S/M/L produk ini di Master Data dulu.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor WO</FormLabel>
                <FormControl>
                  <Input className="h-12 font-mono uppercase" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderedOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal WO</FormLabel>
                <FormControl>
                  <Input type="date" className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="cutterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tukang potong</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    <option value="">Pilih tukang potong</option>
                    {options.cutters.map((cutter) => (
                      <option key={cutter.id} value={cutter.id}>
                        {cutter.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="patternCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kode pola (opsional)</FormLabel>
                <FormControl>
                  <Input
                    className="h-12 font-mono uppercase placeholder:normal-case"
                    placeholder="P-133"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Section title="Bahan">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fabricId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bahan</FormLabel>
                <FormControl>
                  <NativeSelect
                    {...field}
                    disabled={isLocked}
                    onChange={(event) => {
                      field.onChange(event)
                      form.setValue('colorIds', [])
                    }}
                  >
                    <option value="">Pilih bahan</option>
                    {options.fabrics.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fabricCombination"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kombinasi (opsional)</FormLabel>
                <FormControl>
                  <Input
                    className="h-12 uppercase placeholder:normal-case"
                    placeholder="ORB"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {!workOrder && (
          <>
            <FormItem>
              <FormLabel>Ukuran</FormLabel>
              <ChipToggleGroup
                label="Ukuran"
                options={options.sizes.map((size) => ({ id: size.id, label: size.name }))}
                selected={sizeIds}
                onChange={(value) => form.setValue('sizeIds', value, { shouldValidate: true })}
              />
            </FormItem>
            <FormItem>
              <FormLabel>Warna</FormLabel>
              {fabric ? (
                fabric.colors.length > 0 ? (
                  <ChipToggleGroup
                    label="Warna"
                    options={fabric.colors.map((color) => ({ id: color.id, label: color.name }))}
                    selected={colorIds}
                    onChange={(value) => form.setValue('colorIds', value, { shouldValidate: true })}
                  />
                ) : (
                  <p className="text-sm text-warning">
                    Bahan ini belum punya warna. Tambahkan di Master Data.
                  </p>
                )
              ) : (
                <p className="text-muted-foreground text-sm">Pilih bahan dulu.</p>
              )}
            </FormItem>
          </>
        )}
      </Section>

      <Section title="Perubahan dari sampel">
        <SegmentedControl
          label="Status perubahan"
          value={changeStatus}
          onChange={(value) => form.setValue('changeStatus', value, { shouldValidate: true })}
          options={[
            { value: 'follow_sample', label: 'Tidak ada (ikut sampel)' },
            { value: 'changed', label: 'Ada perubahan' },
          ]}
          className="w-fit max-w-full"
        />
        {changeStatus === 'changed' && (
          <FormField
            control={form.control}
            name="changeNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Perubahannya</FormLabel>
                <FormControl>
                  <Textarea placeholder="Mis. bentuk dada model B, list tetap" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </Section>

      <Section title="Info lanjutan">
        <FormField
          control={form.control}
          name="additionalInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catatan di kartu (opsional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Mis. info lebih lanjut hubungi tukang potong" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>
    </div>
  )
}

export function WorkOrderForm({ workOrder }: { workOrder: WorkOrder | null }) {
  const navigate = useNavigate()
  const options = useWorkOrderFormOptions()
  const createWorkOrder = useCreateWorkOrder()
  const updateWorkOrder = useUpdateWorkOrder()
  const [pending, setPending] = useState<WorkOrderFormValues | null>(null)
  const form = useForm<WorkOrderFormInput, unknown, WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: defaultsFor(workOrder),
  })
  useSuggestedNumber(form, workOrder === null)

  const isSaving = createWorkOrder.isPending || updateWorkOrder.isPending
  const saveError = createWorkOrder.error ?? updateWorkOrder.error
  const warnings = confirmationWarnings(createWorkOrder.error)

  const handleError = (error: { kind: string; code?: string }) => {
    if (
      error.kind === 'business' &&
      (error.code === 'WORK_ORDER_NUMBER_TAKEN' || error.code === 'DUPLICATE')
    ) {
      form.setError('number', { message: 'Nomor WO sudah dipakai' })
    }
  }

  const create = (values: WorkOrderFormValues, confirmed: boolean) =>
    createWorkOrder.mutate(
      { ...toPayload(values), sizeIds: values.sizeIds, colorIds: values.colorIds, confirmed },
      {
        onSuccess: ({ id }) => {
          toast.success(`${values.number.toUpperCase()} dibuat`)
          navigate({ to: '/work-order/$id', params: { id } })
        },
        onError: (error) => {
          if (confirmationWarnings(error)) {
            setPending(values)
            return
          }
          handleError(error)
        },
      },
    )

  const onSubmit = form.handleSubmit((values) => {
    if (workOrder) {
      updateWorkOrder.mutate(
        { id: workOrder.id, ...toPayload(values) },
        {
          onSuccess: () => {
            toast.success('Perubahan disimpan')
            navigate({ to: '/work-order/$id', params: { id: workOrder.id } })
          },
          onError: handleError,
        },
      )
      return
    }
    if (values.sizeIds.length === 0 || values.colorIds.length === 0) {
      toast.error('Pilih minimal satu ukuran dan satu warna')
      return
    }
    create(values, false)
  })

  return (
    <div className="space-y-6 pb-24">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link
          to={workOrder ? '/work-order/$id' : '/work-order'}
          params={workOrder ? { id: workOrder.id } : undefined}
        >
          <ArrowLeft />
          {workOrder ? workOrder.number : 'Work Order'}
        </Link>
      </Button>
      <PageHeader
        eyebrow="Work Order"
        title={workOrder ? `Ubah ${workOrder.number}` : 'WO baru'}
        description={
          workOrder?.hasCards
            ? 'Produk dan bahan terkunci karena sudah ada kartu jahit.'
            : 'Diisi sekali, otomatis dipakai di kartu WO, kartu jahit, dan THP.'
        }
      />
      {options.isPending ? (
        <ListSkeleton rows={4} />
      ) : options.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(options.error))}
        </p>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="stagger-1 animate-rise space-y-4">
            <FormFields form={form} options={options.data} workOrder={workOrder} />
            {saveError && !warnings && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(saveError)}
              </p>
            )}
            <div className="chrome sticky bottom-28 z-20 flex justify-end gap-2 rounded-2xl border p-3 lg:bottom-4">
              <Button asChild type="button" variant="ghost" size="lg">
                <Link
                  to={workOrder ? '/work-order/$id' : '/work-order'}
                  params={workOrder ? { id: workOrder.id } : undefined}
                >
                  Batal
                </Link>
              </Button>
              <Button type="submit" size="lg" disabled={isSaving}>
                {isSaving ? 'Menyimpan…' : workOrder ? 'Simpan perubahan' : 'Buat WO'}
              </Button>
            </div>
          </form>
        </Form>
      )}
      <ConfirmWarningsDialog
        warnings={pending ? warnings : null}
        isPending={createWorkOrder.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && create(pending, true)}
      />
    </div>
  )
}
