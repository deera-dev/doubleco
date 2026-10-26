import { z } from 'zod'

const id = z.string().uuid()

export const additionKindSchema = z.enum(['thr', 'bonus', 'other'])

export const payrollLineSchema = z.object({
  id,
  tailorId: id,
  code: z.string(),
  name: z.string(),
  account: z.object({ provider: z.string(), number: z.string(), holder: z.string() }).nullable(),
  grossWage: z.number(),
  advanceRepayment: z.number(),
  deductionTotal: z.number(),
  additionTotal: z.number(),
  newAdvanceTotal: z.number(),
  transferAmount: z.number(),
  advanceBalance: z.number(),
  status: z.enum(['draft', 'paid']),
  paidAt: z.string().nullable(),
  pieces: z.number(),
  cards: z.array(
    z.object({
      number: z.string(),
      quantity: z.number(),
      wage: z.number(),
      category: z.enum(['S', 'M', 'L']),
      submittedOn: z.string().nullable(),
      incomplete: z.boolean(),
      productCode: z.string(),
      sizeName: z.string(),
      colorName: z.string().nullable(),
    }),
  ),
  additions: z.array(
    z.object({ id, kind: additionKindSchema, amount: z.number(), notes: z.string().nullable() }),
  ),
  deductions: z.array(
    z.object({ id, quantity: z.number(), amount: z.number(), cardNumber: z.string() }),
  ),
  newAdvances: z.array(z.object({ id, amount: z.number(), entryOn: z.string() })),
})

export const pendingDeductionSchema = z.object({
  id,
  quantity: z.number(),
  amount: z.number(),
  tailorCode: z.string(),
  tailorName: z.string(),
  cardNumber: z.string(),
  inspectedOn: z.string().nullable(),
  notes: z.string().nullable(),
})

export const payrollOverviewSchema = z.object({
  payOn: z.string(),
  startsOn: z.string(),
  currentPayOn: z.string(),
  isFuture: z.boolean(),
  status: z.enum(['open', 'locked']),
  lockedAt: z.string().nullable(),
  lines: z.array(payrollLineSchema),
  totals: z.object({
    tailors: z.number(),
    cards: z.number(),
    pieces: z.number(),
    grossWage: z.number(),
    transfer: z.number(),
    paid: z.number(),
  }),
  pendingDeductions: z.array(pendingDeductionSchema),
})

export const payrollTailorsSchema = z.object({
  tailors: z.array(z.object({ id, code: z.string(), name: z.string() })),
})

export const savedIdSchema = z.object({ id })
export const savedPayOnSchema = z.object({ payOn: z.string() })

export type PayrollOverview = z.infer<typeof payrollOverviewSchema>
export type PayrollLine = z.infer<typeof payrollLineSchema>
export type PendingDeduction = z.infer<typeof pendingDeductionSchema>
export type AdditionKind = z.infer<typeof additionKindSchema>
export type PayrollTailor = z.infer<typeof payrollTailorsSchema>['tailors'][number]
