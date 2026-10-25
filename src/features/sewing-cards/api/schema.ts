import { z } from 'zod'

const id = z.string().uuid()
const category = z.enum(['S', 'M', 'L'])

export const cardStatusSchema = z.enum(['taken', 'submitted', 'paid', 'cancelled'])

export const sewingCardSchema = z.object({
  id,
  number: z.string(),
  status: cardStatusSchema,
  quantity: z.number(),
  takenOn: z.string(),
  submittedOn: z.string().nullable(),
  submittedAt: z.string().nullable(),
  submittedIncomplete: z.boolean(),
  remainingNotes: z.string().nullable(),
  inspectionStatus: z.enum(['pending', 'in_repair', 'done']),
  category,
  wageAmount: z.number(),
  printCount: z.number(),
  tailorId: id.nullable(),
  tailorCode: z.string().nullable(),
  tailorName: z.string().nullable(),
  workOrderItemId: id,
  sizeName: z.string(),
  colorName: z.string(),
  workOrderId: id,
  workOrderNumber: z.string(),
  productCode: z.string(),
  productName: z.string().nullable(),
  cutterName: z.string(),
  fabricName: z.string(),
})

export const cardListSchema = z.object({
  summary: z.object({
    taken: z.number(),
    submitted: z.number(),
    paid: z.number(),
    cancelled: z.number(),
    all: z.number(),
  }),
  cards: z.array(sewingCardSchema),
})

const boardWorkOrderSchema = z.object({
  id,
  number: z.string(),
  orderedOn: z.string(),
  productCode: z.string(),
  category: category.nullable(),
  cutterName: z.string(),
  cut: z.number(),
  assigned: z.number(),
  remaining: z.number(),
  uncutItems: z.number(),
})

export const boardSchema = z.object({
  readyToSplit: z.array(boardWorkOrderSchema),
  waitingForCut: z.array(boardWorkOrderSchema),
})

export const splitItemSchema = z.object({
  id,
  sizeName: z.string(),
  colorName: z.string(),
  cut: z.number().nullable(),
  assigned: z.number(),
  remaining: z.number().nullable(),
})

export const splitTailorSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  openCards: z.number(),
})

export const splitOptionsSchema = z.object({
  workOrder: z.object({
    id,
    number: z.string(),
    status: z.string(),
    productCode: z.string(),
    category: category.nullable(),
    cutterName: z.string(),
    fabricName: z.string(),
    wageRate: z.number().nullable(),
  }),
  items: z.array(splitItemSchema),
  tailors: z.array(splitTailorSchema),
  today: z.string(),
})

export const scannedCardSchema = sewingCardSchema.extend({
  submittedByName: z.string().nullable(),
})

export const scanOptionsSchema = z.object({
  tailors: z.array(z.object({ id, code: z.string(), name: z.string() })),
  today: z.string(),
})

export const issuedSchema = z.object({ numbers: z.array(z.string()) })
export const cardNumberSchema = z.object({ number: z.string() })
export const countSchema = z.object({ count: z.number() })

export const printDataSchema = z.object({
  cards: z.array(sewingCardSchema),
  missing: z.array(z.string()),
  offsets: z.object({ top: z.number(), left: z.number() }),
})

export type CardStatus = z.infer<typeof cardStatusSchema>
export type SewingCard = z.infer<typeof sewingCardSchema>
export type CardList = z.infer<typeof cardListSchema>
export type Board = z.infer<typeof boardSchema>
export type BoardWorkOrder = z.infer<typeof boardWorkOrderSchema>
export type SplitOptions = z.infer<typeof splitOptionsSchema>
export type SplitItem = z.infer<typeof splitItemSchema>
export type SplitTailor = z.infer<typeof splitTailorSchema>
export type PrintData = z.infer<typeof printDataSchema>
export type ScannedCard = z.infer<typeof scannedCardSchema>
export type ScanOptions = z.infer<typeof scanOptionsSchema>
export type ScanTailor = ScanOptions['tailors'][number]
