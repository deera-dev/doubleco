import { z } from 'zod'

export const workOrderStatusSchema = z.enum(['draft', 'cutting', 'sewing', 'done', 'cancelled'])
export const changeStatusSchema = z.enum(['changed', 'follow_sample'])

export const workOrderItemSchema = z.object({
  id: z.string().uuid(),
  sizeId: z.string().uuid(),
  sizeName: z.string(),
  colorId: z.string().uuid(),
  colorName: z.string(),
  cutQuantity: z.number().nullable(),
  assignedQuantity: z.number(),
  submittedQuantity: z.number(),
  cardCount: z.number(),
})

export const workOrderSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  orderedOn: z.string(),
  status: workOrderStatusSchema,
  productId: z.string().uuid(),
  productCode: z.string(),
  productName: z.string().nullable(),
  category: z.enum(['S', 'M', 'L']).nullable(),
  fabricId: z.string().uuid(),
  fabricName: z.string(),
  fabricCombinationId: z.string().uuid().nullable(),
  fabricCombination: z.string().nullable(),
  cutterId: z.string().uuid(),
  cutterName: z.string(),
  patternId: z.string().uuid().nullable(),
  patternCode: z.string().nullable(),
  changeStatus: changeStatusSchema,
  changeNotes: z.string().nullable(),
  additionalInfo: z.string().nullable(),
  sizes: z.array(z.string()),
  colors: z.array(z.string()),
  items: z.array(workOrderItemSchema),
  totals: z.object({ cut: z.number(), assigned: z.number(), submitted: z.number() }),
  hasCards: z.boolean(),
  hasPhoto: z.boolean(),
  photoUrl: z.string().url().nullable(),
})

export const workOrderListSchema = z.object({
  summary: z.object({
    active: z.number(),
    draft: z.number(),
    cutting: z.number(),
    sewing: z.number(),
    done: z.number(),
    cancelled: z.number(),
    all: z.number(),
  }),
  workOrders: z.array(workOrderSchema),
})

export const formOptionsSchema = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string().nullable(),
      category: z.enum(['S', 'M', 'L']).nullable(),
      defaultPatternId: z.string().uuid().nullable(),
    }),
  ),
  fabrics: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      colors: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    }),
  ),
  sizes: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  cutters: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  patterns: z.array(z.object({ id: z.string().uuid(), code: z.string() })),
})

export const suggestionSchema = z.object({ number: z.string() })
export const savedIdSchema = z.object({ id: z.string().uuid() })
export const photoUploadSchema = z.object({
  bucket: z.string(),
  path: z.string(),
  token: z.string(),
})
export const countSchema = z.object({ count: z.number() })

export const printDataSchema = z.object({
  workOrder: workOrderSchema,
  offsets: z.object({ top: z.number(), left: z.number() }),
})

const requiredLabel = (message: string) => z.string().trim().min(1, message).max(60)

export const workOrderFormSchema = z
  .object({
    number: z.string().trim().min(1, 'Nomor WO wajib diisi').max(60),
    orderedOn: z.string().date('Pilih tanggal'),
    product: requiredLabel('Isi kode produk'),
    category: z.enum(['', 'S', 'M', 'L']),
    cutter: requiredLabel('Isi tukang potong'),
    pattern: z.string().trim().max(40),
    fabric: requiredLabel('Isi bahan'),
    combination: z.string().trim().max(60),
    changeStatus: changeStatusSchema,
    changeNotes: z.string().trim().max(1000),
    additionalInfo: z.string().trim().max(1000),
    sizes: z.array(z.string()),
    colors: z.array(z.string()),
  })
  .superRefine((values, context) => {
    if (values.changeStatus === 'changed' && values.changeNotes === '') {
      context.addIssue({ code: 'custom', path: ['changeNotes'], message: 'Tulis perubahannya' })
    }
    const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (values.combination !== '' && key(values.combination) === key(values.fabric)) {
      context.addIssue({
        code: 'custom',
        path: ['combination'],
        message: 'Kombinasi tidak boleh sama dengan bahan utama',
      })
    }
  })

export type WorkOrder = z.infer<typeof workOrderSchema>
export type WorkOrderItem = z.infer<typeof workOrderItemSchema>
export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>
export type WorkOrderList = z.infer<typeof workOrderListSchema>
export type FormOptions = z.infer<typeof formOptionsSchema>
export type PrintData = z.infer<typeof printDataSchema>
export type WorkOrderFormInput = z.input<typeof workOrderFormSchema>
export type WorkOrderFormValues = z.output<typeof workOrderFormSchema>
