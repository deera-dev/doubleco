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
import { LabelChipPicker } from '@/shared/components/LabelChipPicker'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Combobox } from '@/shared/components/ui/combobox'
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
import { todayIsoDate } from '@/shared/lib/format'
import { findByLabel, labelKey, normalizeLabel } from '@/shared/lib/labels'
import { confirmationWarnings } from '@/shared/lib/warnings'
import { toAppError } from '@/shared/types/errors'

type WorkOrderForm = UseFormReturn<WorkOrderFormInput, unknown, WorkOrderFormValues>

const NEW_HINT = 'Belum ada di Master Data — otomatis ditambahkan saat WO disimpan'

function defaultsFor(workOrder: WorkOrder | null): WorkOrderFormInput {
  return {
    number: workOrder?.number ?? '',
    orderedOn: workOrder?.orderedOn ?? todayIsoDate(),
    product: workOrder?.productCode ?? '',
    category: '',
    cutter: workOrder?.cutterName ?? '',
    pattern: workOrder?.patternCode ?? '',
    fabric: workOrder?.fabricName ?? '',
    combination: workOrder?.fabricCombination ?? '',
    changeStatus: workOrder?.changeStatus ?? 'follow_sample',
    changeNotes: workOrder?.changeNotes ?? '',
    additionalInfo: workOrder?.additionalInfo ?? '',
    sizes: [],
    colors: [],
  }
}

function toPayload(values: WorkOrderFormValues): WorkOrderPayload {
  return {
    number: values.number.toUpperCase(),
    orderedOn: values.orderedOn,
    product: normalizeLabel(values.product),
    category: values.category === '' ? null : values.category,
    fabric: normalizeLabel(values.fabric),
    cutter: normalizeLabel(values.cutter),
    pattern: values.pattern ? normalizeLabel(values.pattern) : null,
    combination: values.combination ? normalizeLabel(values.combination) : null,
    changeStatus: values.changeStatus,
    changeNotes: values.changeStatus === 'changed' ? values.changeNotes : null,
    additionalInfo: values.additionalInfo || null,
  }
}

function needsCategory(options: FormOptions, product: string): boolean {
  if (labelKey(product) === '') return false
  const match = findByLabel(options.products, product, (candidate) => candidate.code)
  return !match || match.category === null
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

function useDebouncedValue(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function useSuggestedNumber(form: WorkOrderForm, isCreating: boolean) {
  const product = useDebouncedValue(form.watch('product'))
  const suggestion = useNumberSuggestion(product, isCreating)
  const suggested = suggestion.data?.number

  useEffect(() => {
    if (suggested && !form.getFieldState('number').isDirty) {
      form.setValue('number', suggested)
    }
  }, [suggested, form])
}

function ProductFields({ form, options, isLocked }: FieldsProps) {
  const product = form.watch('product')
  const category = form.watch('category')
  const isProductSettled =
    form.formState.touchedFields.product === true || form.formState.isSubmitted
  const showCategory = isProductSettled && needsCategory(options, product)
  const match = findByLabel(options.products, product, (candidate) => candidate.code)

  const onProductChange = (value: string) => {
    form.setValue('product', value, { shouldValidate: form.formState.isSubmitted })
    const chosen = findByLabel(options.products, value, (candidate) => candidate.code)
    const pattern = options.patterns.find((candidate) => candidate.id === chosen?.defaultPatternId)
    if (pattern && !form.getFieldState('pattern').isDirty) {
      form.setValue('pattern', pattern.code)
    }
  }

  return (
    <>
      <FormField
        control={form.control}
        name="product"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Kode produk</FormLabel>
            <FormControl>
              <Combobox
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={onProductChange}
                onBlur={field.onBlur}
                disabled={isLocked}
                placeholder="Ketik, mis. W-133 BLS"
                className="font-mono"
                options={options.products.map((candidate) => ({
                  label: candidate.code,
                  hint: candidate.category ? `kategori ${candidate.category}` : 'tanpa kategori',
                }))}
                newHint={NEW_HINT}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showCategory && (
        <FormField
          control={form.control}
          name="category"
          render={() => (
            <FormItem className="animate-rise">
              <FormLabel>Kategori upah {match ? 'produk ini' : 'produk baru'}</FormLabel>
              <ChipToggleGroup
                label="Kategori upah"
                options={['S', 'M', 'L'].map((value) => ({ id: value, label: value }))}
                selected={category === '' ? [] : [category]}
                onChange={(selected) => {
                  const value = selected.at(-1)
                  form.setValue(
                    'category',
                    value === 'S' || value === 'M' || value === 'L' ? value : '',
                    {
                      shouldValidate: true,
                    },
                  )
                }}
              />
              <FormDescription>Disimpan ke Master Data → Produk. Wajib dipilih.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  )
}

interface FieldsProps {
  form: WorkOrderForm
  options: FormOptions
  isLocked: boolean
}

function FormFields({
  form,
  options,
  workOrder,
}: {
  form: WorkOrderForm
  options: FormOptions
  workOrder: WorkOrder | null
}) {
  const fabric = form.watch('fabric')
  const changeStatus = form.watch('changeStatus')
  const sizes = form.watch('sizes')
  const colors = form.watch('colors')
  const isLocked = workOrder?.hasCards ?? false
  const fabricMatch = findByLabel(options.fabrics, fabric, (candidate) => candidate.name)
  const fabricOptions = options.fabrics.map((candidate) => ({
    label: candidate.name,
    hint: `${candidate.colors.length} warna`,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Produk & potong">
        <ProductFields form={form} options={options} isLocked={isLocked} />
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
            name="cutter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tukang potong</FormLabel>
                <FormControl>
                  <Combobox
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Ketik nama"
                    options={options.cutters.map((cutter) => ({ label: cutter.name }))}
                    newHint={NEW_HINT}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kode pola (opsional)</FormLabel>
                <FormControl>
                  <Combobox
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Mis. P-133"
                    className="font-mono"
                    options={options.patterns.map((pattern) => ({ label: pattern.code }))}
                    newHint={NEW_HINT}
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
            name="fabric"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bahan</FormLabel>
                <FormControl>
                  <Combobox
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      if (labelKey(value) !== labelKey(field.value)) form.setValue('colors', [])
                      field.onChange(value)
                    }}
                    onBlur={field.onBlur}
                    disabled={isLocked}
                    placeholder="Mis. BLACK SWAN"
                    options={fabricOptions}
                    newHint={NEW_HINT}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="combination"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kombinasi (opsional)</FormLabel>
                <FormControl>
                  <Combobox
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Mis. ORB"
                    options={fabricOptions.filter(
                      (option) => labelKey(option.label) !== labelKey(fabric),
                    )}
                    newHint={NEW_HINT}
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
              <LabelChipPicker
                label="Ukuran"
                options={options.sizes.map((size) => size.name)}
                selected={sizes}
                onChange={(value) => form.setValue('sizes', value)}
                addPlaceholder="Ukuran lain, mis. JUMBO"
              />
            </FormItem>
            <FormItem>
              <FormLabel>Warna</FormLabel>
              {labelKey(fabric) === '' ? (
                <p className="text-muted-foreground text-sm">Isi bahan dulu.</p>
              ) : (
                <LabelChipPicker
                  label="Warna"
                  options={fabricMatch?.colors.map((color) => color.name) ?? []}
                  selected={colors}
                  onChange={(value) => form.setValue('colors', value)}
                  addPlaceholder={`Warna ${normalizeLabel(fabric)} lain`}
                />
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
      { ...toPayload(values), sizes: values.sizes, colors: values.colors, confirmed },
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
    if (options.data && needsCategory(options.data, values.product) && values.category === '') {
      form.setError('category', { message: 'Pilih kategori S, M, atau L' })
      return
    }
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
    if (values.sizes.length === 0 || values.colors.length === 0) {
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
            <div className="chrome hide-with-keyboard sticky bottom-28 z-20 flex justify-end gap-2 rounded-2xl border p-3 lg:bottom-4">
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
