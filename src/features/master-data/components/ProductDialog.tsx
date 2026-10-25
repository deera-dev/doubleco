import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useRemoveMasterData, useSaveProduct } from '@/features/master-data/api/mutations'
import {
  type Pattern,
  type Product,
  type ProductFormInput,
  type ProductFormValues,
  productFormSchema,
  type WageRateGroup,
} from '@/features/master-data/api/schema'
import { useMasterDataUiStore } from '@/features/master-data/store'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Switch } from '@/shared/components/ui/switch'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function ProductDialog({
  product,
  wageRates,
  patterns,
}: {
  product: Product | null
  wageRates: WageRateGroup[]
  patterns: Pattern[]
}) {
  const closeEditor = useMasterDataUiStore((state) => state.closeEditor)
  const saveProduct = useSaveProduct()
  const removeProduct = useRemoveMasterData()
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      code: product?.code ?? '',
      name: product?.name ?? '',
      category: product?.category ?? '',
      defaultPatternId: product?.defaultPatternId ?? '',
    },
  })
  const category = form.watch('category')

  const onSubmit = form.handleSubmit((values) =>
    saveProduct.mutate(
      {
        id: product?.id ?? null,
        code: values.code,
        name: values.name || null,
        category: values.category === '' ? null : values.category,
        defaultPatternId: values.defaultPatternId || null,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success(product ? 'Produk diperbarui' : `${values.code} ditambahkan`)
          closeEditor()
        },
        onError: (error) => {
          if (error.kind === 'business' && error.code === 'DUPLICATE') {
            form.setError('code', { message: 'Kode produk sudah ada' })
          }
        },
      },
    ),
  )

  const remove = () =>
    product &&
    removeProduct.mutate(
      { kind: 'product', id: product.id },
      {
        onSuccess: () => {
          toast.success(`${product.code} dihapus`)
          closeEditor()
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? `Ubah ${product.code}` : 'Tambah produk'}</DialogTitle>
          <DialogDescription>
            Kategori kesulitan menentukan upah jahit per potong di setiap kartu.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kode produk</FormLabel>
                  <FormControl>
                    <Input
                      autoCapitalize="characters"
                      placeholder="W-133 BLS"
                      className="h-12 font-mono uppercase placeholder:normal-case"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama model (opsional)</FormLabel>
                  <FormControl>
                    <Input className="h-12" placeholder="Gamis midi bordir" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={() => (
                <FormItem>
                  <FormLabel>Kategori kesulitan</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {wageRates.map((rate) => (
                      <button
                        key={rate.category}
                        type="button"
                        aria-pressed={category === rate.category}
                        onClick={() =>
                          form.setValue('category', category === rate.category ? '' : rate.category)
                        }
                        className={cn(
                          'surface interactive flex flex-col items-center gap-0.5 rounded-2xl py-3',
                          category === rate.category &&
                            'sheen-primary border-transparent text-primary-foreground',
                        )}
                      >
                        <span className="font-semibold text-xl">{rate.category}</span>
                        <span
                          className={cn(
                            'font-mono text-muted-foreground text-xs tabular-nums',
                            category === rate.category && 'text-brand-50',
                          )}
                        >
                          {rate.current ? formatRupiah(rate.current.amount) : '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <FormDescription>
                    Wajib diisi sebelum produk bisa dipakai di Work Order.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultPatternId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kode pola bawaan (opsional)</FormLabel>
                  <FormControl>
                    <NativeSelect className="font-mono" {...field}>
                      <option value="">Tanpa pola bawaan</option>
                      {patterns
                        .filter(
                          (pattern) => pattern.isActive || pattern.id === product?.defaultPatternId,
                        )
                        .map((pattern) => (
                          <option key={pattern.id} value={pattern.id}>
                            {pattern.code}
                          </option>
                        ))}
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>Otomatis terpilih saat membuat WO produk ini.</FormDescription>
                </FormItem>
              )}
            />
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              label="Aktif"
              description="Produk tidak aktif tidak muncul saat membuat WO."
            />
            {saveProduct.error && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(saveProduct.error)}
              </p>
            )}
            <DialogFooter>
              {product && (
                <ConfirmDeleteButton
                  label="Hapus"
                  className="sm:mr-auto"
                  onConfirm={remove}
                  isPending={removeProduct.isPending}
                />
              )}
              <Button type="button" variant="ghost" size="lg" onClick={closeEditor}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={saveProduct.isPending}>
                {saveProduct.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
