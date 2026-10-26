import { z } from 'zod'

const id = z.string().uuid()

export const balanceSchema = z.object({
  tailorId: id,
  code: z.string(),
  name: z.string(),
  status: z.string(),
  borrowed: z.number(),
  repaid: z.number(),
  writtenOff: z.number(),
  balance: z.number(),
})

export const overviewSchema = z.object({
  tailors: z.array(balanceSchema),
  totalBalance: z.number(),
  today: z.string(),
})

export const entryTypeSchema = z.enum(['opening_balance', 'advance', 'repayment', 'write_off'])

export const entrySchema = z.object({
  id,
  type: entryTypeSchema,
  amount: z.number(),
  entryOn: z.string(),
  notes: z.string().nullable(),
  payOn: z.string().nullable(),
  isPayrollLocked: z.boolean(),
  isEditable: z.boolean(),
  isDeletable: z.boolean(),
})

export const ledgerSchema = z.object({
  tailor: balanceSchema,
  today: z.string(),
  entries: z.array(entrySchema),
})

export const savedIdSchema = z.object({ id })

export type TailorBalance = z.infer<typeof balanceSchema>
export type CashAdvanceOverview = z.infer<typeof overviewSchema>
export type LedgerEntry = z.infer<typeof entrySchema>
export type EntryType = z.infer<typeof entryTypeSchema>
export type Ledger = z.infer<typeof ledgerSchema>
