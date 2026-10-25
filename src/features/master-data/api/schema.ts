import { z } from 'zod'

export const wageCategorySchema = z.enum(['S', 'M', 'L'])

export const productSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string().nullable(),
  category: wageCategorySchema.nullable(),
  defaultPatternId: z.string().uuid().nullable(),
  isActive: z.boolean(),
})

export const patternSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
})

export const colorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
})

export const fabricSeriesSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  colors: z.array(colorSchema),
})

export const fabricKindSchema = z.enum(['motif', 'plain'])

export const fabricSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: fabricKindSchema,
  code: z.string().nullable(),
  isActive: z.boolean(),
  series: z.array(fabricSeriesSchema),
})

export const sizeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
  isActive: z.boolean(),
})

export const wageRateGroupSchema = z.object({
  category: wageCategorySchema,
  current: z.object({ amount: z.number(), effectiveFrom: z.string() }).nullable(),
  history: z.array(
    z.object({
      id: z.string().uuid(),
      amount: z.number(),
      effectiveFrom: z.string(),
      isFuture: z.boolean(),
      isCurrent: z.boolean(),
    }),
  ),
})

export const masterDataSchema = z.object({
  products: z.array(productSchema),
  patterns: z.array(patternSchema),
  fabrics: z.array(fabricSchema),
  sizes: z.array(sizeSchema),
  wageRates: z.array(wageRateGroupSchema),
})

export const savedIdSchema = z.object({ id: z.string().uuid() })

export const productFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Kode produk wajib diisi')
    .max(40, 'Maksimal 40 karakter')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().max(80, 'Maksimal 80 karakter'),
  category: z.enum(['', 'S', 'M', 'L']),
  defaultPatternId: z.string(),
})

export const nameFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama wajib diisi')
    .max(60, 'Maksimal 60 karakter')
    .transform((value) => value.toUpperCase()),
})

export const wageRateFormSchema = z.object({
  category: wageCategorySchema,
  amount: z
    .string()
    .trim()
    .regex(/^[0-9.]+$/, 'Isi angka saja')
    .transform((value) => Number(value.replaceAll('.', '')))
    .refine((value) => value > 0, 'Tarif harus lebih dari 0'),
  effectiveFrom: z.string().date('Pilih tanggal berlaku'),
})

export type WageCategory = z.infer<typeof wageCategorySchema>
export type Product = z.infer<typeof productSchema>
export type Pattern = z.infer<typeof patternSchema>
export type Fabric = z.infer<typeof fabricSchema>
export type FabricColor = z.infer<typeof colorSchema>
export type FabricSeries = z.infer<typeof fabricSeriesSchema>
export type FabricKind = z.infer<typeof fabricKindSchema>
export type Size = z.infer<typeof sizeSchema>
export type WageRateGroup = z.infer<typeof wageRateGroupSchema>
export type MasterData = z.infer<typeof masterDataSchema>
export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>
export type NameFormInput = z.input<typeof nameFormSchema>
export type NameFormValues = z.output<typeof nameFormSchema>
export type WageRateFormInput = z.input<typeof wageRateFormSchema>
export type WageRateFormValues = z.output<typeof wageRateFormSchema>
