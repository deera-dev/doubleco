import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type FieldErrors, type UseFormReturn, useForm } from 'react-hook-form'
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
import {
  composeProductCode,
  cutterInitial,
  parseProductCode,
  previewProductCode,
} from '@/features/work-orders/lib/product-code'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
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
import { focusFirstInvalid } from '@/shared/lib/focus-error'
import { todayIsoDate } from '@/shared/lib/format'
import { findByLabel, labelKey, normalizeLabel } from '@/shared/lib/labels'
import { cn } from '@/shared/lib/utils'
import { confirmationWarnings } from '@/shared/lib/warnings'
import { toAppError } from '@/shared/types/errors'

type WorkOrderForm = UseFormReturn<WorkOrderFormInput, unknown, WorkOrderFormValues>

const NEW_HINT = 'Belum ada di Master Data — otomatis ditambahkan saat WO disimpan'

/** Form order, so the summary reads top to bottom like the page. */
const FIELD_LABELS: Partial<Record<keyof WorkOrderFormInput, string>> = {
  cutter: 'Tukang potong',
  fabric: 'Bahan',
  productNumber: 'Nomor produk',
  fabricCode: 'Kode bahan',
  category: 'Kategori upah',
  pattern: 'Kode pola',
  combination: 'Kombinasi',
  sizes: 'Ukuran',
  changeNotes: 'Perubahannya',
  additionalInfo: 'Catatan',
  number: 'Nomor WO',
  orderedOn: 'Tanggal WO',
}

/** Server rejections that belong to one field: shown under that field instead of at the bottom. */
const FIELD_ERRORS: Record<string, { field: keyof WorkOrderFormInput; message: string }> = {
  WORK_ORDER_NUMBER_TAKEN: { field: 'number', message: 'Nomor WO sudah dipakai' },
  DUPLICATE: { field: 'number', message: 'Nomor WO sudah dipakai' },
  FABRIC_CODE_TAKEN: { field: 'fabricCode', message: 'Kode bahan sudah dipakai bahan lain' },
  PRODUCT_CATEGORY_MISSING: { field: 'category', message: 'Pilih kategori S, M, atau L' },
  FABRIC_COMBINATION_SAME: {
    field: 'combination',
    message: 'Kombinasi tidak boleh sama dengan bahan utama',
  },
  WORK_ORDER_SIZES_REQUIRED: { field: 'sizes', message: 'Pilih minimal satu ukuran' },
}

function missingFields(errors: FieldErrors<WorkOrderFormInput>) {
  return Object.entries(FIELD_LABELS).flatMap(([name, label]) =>
    errors[name as keyof WorkOrderFormInput] ? [label] : [],
  )
}

function defaultsFor(workOrder: WorkOrder | null): WorkOrderFormInput {
  return {
    number: workOrder?.number ?? '',
    orderedOn: workOrder?.orderedOn ?? todayIsoDate(),
    productNumber: workOrder
      ? (parseProductCode(workOrder.productCode)?.number ?? workOrder.productCode)
      : '',
    fabricCode: workOrder ? (parseProductCode(workOrder.productCode)?.fabricCode ?? '') : '',
    category: '',
    cutter: workOrder?.cutterName ?? '',
    pattern: workOrder?.patternCode ?? '',
    fabric: workOrder?.fabricName ?? '',
    combination: workOrder?.fabricCombination ?? '',
    changeStatus: workOrder?.changeStatus ?? 'follow_sample',
    changeNotes: workOrder?.changeNotes ?? '',
    additionalInfo: workOrder?.additionalInfo ?? '',
    sizes: [],
  }
}

function productCodeOf(
  values: Pick<WorkOrderFormValues, 'cutter' | 'productNumber' | 'fabricCode'>,
) {
  return composeProductCode(values.cutter, values.productNumber, values.fabricCode)
}

function toPayload(values: WorkOrderFormValues, keepProduct: string | null): WorkOrderPayload {
  return {
    number: values.number.toUpperCase(),
    orderedOn: values.orderedOn,
    product: keepProduct ?? productCodeOf(values),
    category: values.category === '' ? null : values.category,
    fabric: normalizeLabel(values.fabric),
    fabricCode: normalizeLabel(values.fabricCode) || null,
    cutter: normalizeLabel(values.cutter),
    pattern: values.pattern ? normalizeLabel(values.pattern) : null,
    combination: values.combination ? normalizeLabel(values.combination) : null,
    changeStatus: values.changeStatus,
    changeNotes: values.changeStatus === 'changed' ? values.changeNotes : null,
    additionalInfo: values.additionalInfo || null,
  }
}

function siblingProduct(options: FormOptions, number: string) {
  const key = labelKey(number)
  if (key === '') return undefined
  const siblings = options.products.filter(
    (candidate) => labelKey(parseProductCode(candidate.code)?.number ?? '') === key,
  )
  return siblings.find((candidate) => candidate.category !== null) ?? siblings[0]
}

function needsCategory(options: FormOptions, product: string): boolean {
  if (labelKey(product) === '') return false
  const match = findByLabel(options.products, product, (candidate) => candidate.code)
  return !match || match.category === null
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // A card blurs its backdrop, which traps the suggestion list inside it: the card being typed in
    // is lifted above the cards after it.
    <section className="surface space-y-4 rounded-3xl p-5 focus-within:z-10 sm:p-6">
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
  const product = useDebouncedValue(
    composeProductCode(form.watch('cutter'), form.watch('productNumber'), form.watch('fabricCode')),
  )
  const suggestion = useNumberSuggestion(product, isCreating)
  const suggested = suggestion.data?.number

  useEffect(() => {
    if (suggested && !form.getFieldState('number').isDirty) {
      form.setValue('number', suggested)
    }
  }, [suggested, form])
}

/** Kode produk = cutter initial – product number + fabric code, built right where it is typed. */
function ProductCodeBuilder({ form, options, isLocked }: FieldsProps) {
  const cutter = form.watch('cutter')
  const productNumber = form.watch('productNumber')
  const fabricCode = form.watch('fabricCode')
  const fabric = form.watch('fabric')
  const product = composeProductCode(cutter, productNumber, fabricCode)
  const match = findByLabel(options.products, product, (candidate) => candidate.code)
  const initial = cutterInitial(cutter)
  const fabricMatch = findByLabel(options.fabrics, fabric, (candidate) => candidate.name)
  const numberOptions = [
    ...new Map(
      options.products.flatMap((candidate) => {
        const parts = parseProductCode(candidate.code)
        return parts ? [[labelKey(parts.number), parts.number] as const] : []
      }),
    ).values(),
  ].map((value) => ({
    label: value,
    hint: options.products
      .filter(
        (candidate) => labelKey(parseProductCode(candidate.code)?.number ?? '') === labelKey(value),
      )
      .map((candidate) => candidate.code)
      .slice(0, 2)
      .join(', '),
  }))

  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border p-4',
        product ? 'border-brand-400/40 bg-brand-500/10' : 'border-dashed',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-sm">Kode produk</p>
        <p className="truncate font-mono font-semibold text-lg tracking-tight">
          {previewProductCode(cutter, productNumber, fabricCode)}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-14 shrink-0 space-y-1">
          <div
            title="Huruf dari tukang potong"
            className="flex h-12 items-center justify-center rounded-xl border border-border-strong bg-background/60 font-mono font-semibold text-lg"
          >
            {initial || <span className="text-subtle-foreground">?</span>}
          </div>
          <p className="text-center text-subtle-foreground text-xs leading-tight">huruf</p>
        </div>
        <span className="pt-3 font-mono text-muted-foreground">–</span>
        <FormField
          control={form.control}
          name="productNumber"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1 gap-1">
              <FormControl>
                <Combobox
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isLocked}
                  inputMode="numeric"
                  placeholder="124"
                  aria-label="Nomor produk"
                  className="font-mono"
                  options={numberOptions}
                />
              </FormControl>
              <p className="text-center text-subtle-foreground text-xs leading-tight">
                nomor produk
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fabricCode"
          render={({ field }) => (
            <FormItem className="w-24 shrink-0 gap-1">
              <FormControl>
                <Input
                  {...field}
                  disabled={isLocked}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="VCS"
                  aria-label="Kode bahan"
                  className="h-12 text-center font-mono uppercase placeholder:normal-case"
                />
              </FormControl>
              <p className="text-center text-subtle-foreground text-xs leading-tight">kode bahan</p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {product === ''
          ? 'Cukup ketik nomor produk. Huruf diambil dari tukang potong, kode bahan dari bahan.'
          : match
            ? match.category
              ? `Produk sudah ada · kategori ${match.category}`
              : 'Produk sudah ada · kategori belum diisi'
            : 'Produk baru · ditambahkan ke Master Data saat WO disimpan'}
      </p>
      <FabricCodeHint fabric={fabricMatch} code={fabricCode} />
    </div>
  )
}

function CategoryField({ form, options }: Omit<FieldsProps, 'isLocked'>) {
  const cutter = form.watch('cutter')
  const productNumber = form.watch('productNumber')
  const fabricCode = form.watch('fabricCode')
  const category = form.watch('category')
  const product = composeProductCode(cutter, productNumber, fabricCode)
  const match = findByLabel(options.products, product, (candidate) => candidate.code)
  const sibling = match ?? siblingProduct(options, productNumber)

  useEffect(() => {
    if (!sibling) return
    if (sibling.category && form.getValues('category') === '' && sibling.id !== match?.id) {
      form.setValue('category', sibling.category)
    }
    const pattern = options.patterns.find((candidate) => candidate.id === sibling.defaultPatternId)
    if (pattern && !form.getFieldState('pattern').isDirty) {
      form.setValue('pattern', pattern.code)
    }
  }, [sibling, match, options.patterns, form])

  if (product === '' || !needsCategory(options, product)) return null

  return (
    <FormField
      control={form.control}
      name="category"
      render={({ fieldState }) => (
        <FormItem className="animate-rise">
          <FormLabel>Kategori upah {match ? 'produk ini' : 'produk baru'}</FormLabel>
          <ChipToggleGroup
            invalid={fieldState.invalid}
            label="Kategori upah"
            options={['S', 'M', 'L'].map((value) => ({ id: value, label: value }))}
            selected={category === '' ? [] : [category]}
            onChange={(selected) => {
              const value = selected.at(-1)
              form.setValue(
                'category',
                value === 'S' || value === 'M' || value === 'L' ? value : '',
                { shouldValidate: true },
              )
            }}
          />
          <FormDescription>
            {sibling && sibling.id !== match?.id && sibling.category
              ? `Diambil dari ${sibling.code}. Bisa diganti.`
              : 'Disimpan ke Master Data → Produk. Wajib dipilih.'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Number and date fill themselves in; they stay folded unless someone wants to change them. */
function RecordFields({ form }: { form: WorkOrderForm }) {
  const number = form.watch('number')
  const orderedOn = form.watch('orderedOn')
  const hasError = Boolean(form.formState.errors.number || form.formState.errors.orderedOn)
  const [isOpen, setIsOpen] = useState(false)
  const isShown = isOpen || hasError

  return (
    <div className="space-y-4 rounded-2xl border border-dashed px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="text-muted-foreground text-xs">Nomor & tanggal WO · otomatis</p>
          <p className="truncate">
            <span className="font-mono">{number || 'dibuat setelah kode produk terisi'}</span>
            {' · '}
            {orderedOn ? formatWorkOrderDate(orderedOn) : '-'}
          </p>
        </div>
        {!hasError && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isShown}
          >
            {isShown ? 'Tutup' : 'Ubah'}
          </Button>
        )}
      </div>
      {isShown && (
        <div className="grid animate-rise gap-4 sm:grid-cols-2">
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
      )}
    </div>
  )
}

function FabricCodeHint({
  fabric,
  code,
}: {
  fabric: FormOptions['fabrics'][number] | undefined
  code: string
}) {
  if (labelKey(code) === '') return null
  if (!fabric?.code) {
    return (
      <p className="text-brand-200 text-xs">
        Kode bahan {code.toUpperCase()} disimpan untuk {fabric ? fabric.name : 'bahan baru ini'} di
        Master Data.
      </p>
    )
  }
  if (labelKey(fabric.code) !== labelKey(code)) {
    return (
      <p className="text-muted-foreground text-xs">
        Kode bahan {fabric.name} di Master Data: {fabric.code}. Yang ini hanya untuk produk ini.
      </p>
    )
  }
  return null
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
  const isLocked = workOrder?.hasCards ?? false
  const isFabricLocked = workOrder !== null
  const fabricOptionsFor = (preferred: 'motif' | 'plain') =>
    [...options.fabrics]
      .sort((a, b) => Number(a.kind !== preferred) - Number(b.kind !== preferred))
      .map((candidate) => ({
        label: candidate.name,
        hint: [
          candidate.kind === 'motif' ? 'motif' : 'polos',
          candidate.code ? `kode ${candidate.code}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }))

  const onFabricChange = (value: string) => {
    if (labelKey(value) === labelKey(fabric)) {
      form.setValue('fabric', value)
      return
    }
    const match = findByLabel(options.fabrics, value, (candidate) => candidate.name)
    form.setValue('fabric', value, { shouldValidate: form.formState.isSubmitted })
    if (match?.code && !form.getFieldState('fabricCode').isDirty) {
      form.setValue('fabricCode', match.code, { shouldValidate: form.formState.isSubmitted })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Produk">
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
                  disabled={isLocked}
                  placeholder="Ketik nama"
                  options={options.cutters.map((candidate) => ({
                    label: candidate.name,
                    hint: `huruf ${cutterInitial(candidate.name)}`,
                  }))}
                  newHint={NEW_HINT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                  onValueChange={onFabricChange}
                  onBlur={field.onBlur}
                  disabled={isFabricLocked}
                  placeholder="Mis. BLACK SWAN"
                  options={fabricOptionsFor('motif')}
                  newHint={NEW_HINT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ProductCodeBuilder form={form} options={options} isLocked={isLocked} />
        <CategoryField form={form} options={options} />
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
      </Section>

      <Section title={workOrder ? 'Kombinasi' : 'Kombinasi & ukuran'}>
        <FormField
          control={form.control}
          name="combination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kombinasi · bahan polos (opsional)</FormLabel>
              <FormControl>
                <Combobox
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Mis. ORB"
                  options={fabricOptionsFor('plain').filter(
                    (option) => labelKey(option.label) !== labelKey(fabric),
                  )}
                  newHint={NEW_HINT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!workOrder && (
          <>
            <FormField
              control={form.control}
              name="sizes"
              render={({ fieldState }) => (
                <FormItem>
                  <FormLabel>Ukuran</FormLabel>
                  <LabelChipPicker
                    label="Ukuran"
                    options={options.sizes.map((size) => size.name)}
                    selected={sizes}
                    onChange={(value) =>
                      form.setValue('sizes', value, { shouldValidate: fieldState.invalid })
                    }
                    addPlaceholder="Ukuran lain, mis. JUMBO"
                    invalid={fieldState.invalid}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="rounded-2xl border border-dashed px-4 py-3 text-muted-foreground text-sm">
              Setelah dipotong, jumlah iketan per ukuran diisi di halaman WO → Hasil potong.
            </p>
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
        <RecordFields form={form} />
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
  const [focusRequest, setFocusRequest] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const form = useForm<WorkOrderFormInput, unknown, WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: defaultsFor(workOrder),
    shouldFocusError: false,
  })
  useSuggestedNumber(form, workOrder === null)

  // Waits for every error to render (react-hook-form publishes schema errors after onInvalid),
  // so the scroll lands on the first missing field in page order.
  useEffect(() => {
    if (focusRequest === 0) return
    const timer = window.setTimeout(() => focusFirstInvalid(formRef.current), 50)
    return () => window.clearTimeout(timer)
  }, [focusRequest])
  const focusError = () => setFocusRequest((count) => count + 1)

  const isSaving = createWorkOrder.isPending || updateWorkOrder.isPending
  const saveError = createWorkOrder.error ?? updateWorkOrder.error
  const warnings = confirmationWarnings(createWorkOrder.error)
  const fieldError = saveError?.kind === 'business' ? FIELD_ERRORS[saveError.code] : undefined
  const missing = form.formState.isSubmitted ? missingFields(form.formState.errors) : []

  const handleError = (error: { kind: string; code?: string }) => {
    const target = error.kind === 'business' && error.code ? FIELD_ERRORS[error.code] : undefined
    if (!target) return
    form.setError(target.field, { message: target.message })
    focusError()
  }

  /** Checks the schema can't express: they depend on Master Data or on create vs edit. */
  const checkExtra = (values: WorkOrderFormInput) => {
    let isValid = true
    const product = keptProductCode() ?? productCodeOf(values)
    if (options.data && needsCategory(options.data, product) && values.category === '') {
      form.setError('category', { message: 'Pilih kategori S, M, atau L' })
      isValid = false
    }
    if (!workOrder && values.sizes.length === 0) {
      form.setError('sizes', { message: 'Pilih minimal satu ukuran' })
      isValid = false
    }
    return isValid
  }

  const create = (values: WorkOrderFormValues, confirmed: boolean) =>
    createWorkOrder.mutate(
      { ...toPayload(values, null), sizes: values.sizes, confirmed },
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

  const keptProductCode = () => {
    if (!workOrder) return null
    const touched = (['cutter', 'productNumber', 'fabricCode'] as const).some(
      (name) => form.getFieldState(name).isDirty,
    )
    return touched ? null : workOrder.productCode
  }

  const onSubmit = form.handleSubmit(
    (values) => {
      if (!checkExtra(values)) {
        focusError()
        return
      }
      save(values)
    },
    () => {
      checkExtra(form.getValues())
      focusError()
    },
  )

  const save = (values: WorkOrderFormValues) => {
    if (workOrder) {
      updateWorkOrder.mutate(
        { id: workOrder.id, ...toPayload(values, keptProductCode()) },
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
    create(values, false)
  }

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
          <form
            ref={formRef}
            onSubmit={onSubmit}
            noValidate
            className="stagger-1 animate-rise space-y-4"
          >
            <FormFields form={form} options={options.data} workOrder={workOrder} />
            {saveError && !warnings && !fieldError && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(saveError)}
              </p>
            )}
            <div className="action-bar hide-with-keyboard sticky bottom-28 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border p-3 lg:bottom-4">
              {missing.length > 0 && (
                <p
                  role="alert"
                  className="mr-auto basis-full text-destructive text-sm sm:basis-auto"
                >
                  Lengkapi dulu: {missing.join(', ')}
                </p>
              )}
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
