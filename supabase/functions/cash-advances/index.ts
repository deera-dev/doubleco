import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createUserClient } from '../_shared/supabase.ts'

const uuid = z.string().uuid()
const amount = z.number().int().positive().max(1_000_000_000)
const notes = z.string().trim().max(300).nullable().default(null)
const reason = z.string().trim().max(200).nullable().default(null)

type EntryType = 'opening_balance' | 'advance' | 'repayment' | 'write_off'

interface BalanceRow {
  tailor_id: string
  tailor_code: string
  tailor_name: string
  tailor_status: string
  total_borrowed: number
  total_repaid: number
  total_written_off: number
  balance: number
}

interface EntryRow {
  id: string
  entry_type: EntryType
  amount: number
  entry_on: string
  notes: string | null
  created_at: string
  payroll_line_id: string | null
  import_batch_id: string | null
  payroll_lines: { payroll_periods: { pay_on: string; status: string } | null } | null
}

function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, 'id', { numeric: true })
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shapeBalance(row: BalanceRow) {
  return {
    tailorId: row.tailor_id,
    code: row.tailor_code,
    name: row.tailor_name,
    status: row.tailor_status,
    borrowed: Number(row.total_borrowed),
    repaid: Number(row.total_repaid),
    writtenOff: Number(row.total_written_off),
    balance: Number(row.balance),
  }
}

const overview = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const [balances, tailors] = await Promise.all([
      supabase.from('tailor_advance_balances').select('*'),
      supabase.from('tailors').select('id, archived_at'),
    ])
    const archived = new Set(
      unwrap<{ id: string; archived_at: string | null }[]>(tailors)
        .filter((tailor) => tailor.archived_at !== null)
        .map((tailor) => tailor.id),
    )
    const rows = unwrap<BalanceRow[]>(balances)
      .filter((row) => !archived.has(row.tailor_id) || Number(row.balance) !== 0)
      .map(shapeBalance)
      .sort((a, b) => compareCodes(a.code, b.code))
    return {
      tailors: rows,
      totalBalance: rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
      today: today(),
    }
  },
})

const ledger = defineAction({
  input: z.object({ tailorId: uuid }),
  run: async ({ tailorId }, request) => {
    const supabase = createUserClient(request)
    const [balance, entries] = await Promise.all([
      supabase.from('tailor_advance_balances').select('*').eq('tailor_id', tailorId).maybeSingle(),
      supabase
        .from('cash_advance_entries')
        .select(
          'id, entry_type, amount, entry_on, notes, created_at, payroll_line_id, import_batch_id, payroll_lines(payroll_periods(pay_on, status))',
        )
        .eq('tailor_id', tailorId)
        .order('entry_on', { ascending: false })
        .order('created_at', { ascending: false }),
    ])
    const row = unwrap<BalanceRow | null>(balance)
    if (!row) throw new Rejection('TAILOR_NOT_FOUND', 404)
    return {
      tailor: shapeBalance(row),
      today: today(),
      entries: unwrap<EntryRow[]>(entries).map((entry) => {
        const period = entry.payroll_lines?.payroll_periods ?? null
        const isPayrollRepayment = entry.entry_type === 'repayment' && entry.payroll_line_id !== null
        return {
          id: entry.id,
          type: entry.entry_type,
          amount: Number(entry.amount),
          entryOn: entry.entry_on,
          notes: entry.notes,
          payOn: period?.pay_on ?? null,
          isPayrollLocked: period?.status === 'locked',
          isEditable:
            entry.entry_type !== 'write_off' &&
            !isPayrollRepayment &&
            entry.import_batch_id === null &&
            period?.status !== 'locked',
          // Anything can be deleted (test data, wrong input) once its payroll week is open.
          isDeletable: period?.status !== 'locked',
        }
      }),
    }
  },
})

const entryInput = z.object({
  tailorId: uuid,
  amount,
  entryOn: z.string().date(),
  notes,
  confirmed: z.boolean().default(false),
  reason,
})

const recordAdvance = defineAction({
  input: entryInput,
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const created = unwrap<{ id: string }>(
      await supabase
        .rpc('record_cash_advance', {
          p_tailor_id: input.tailorId,
          p_amount: input.amount,
          p_entry_on: input.entryOn,
          p_notes: input.notes,
          p_confirmed: input.confirmed,
          p_override_reason: input.reason,
        })
        .single(),
    )
    return { id: created.id }
  },
})

const recordRepayment = defineAction({
  input: entryInput,
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const created = unwrap<{ id: string }>(
      await supabase
        .rpc('record_manual_repayment', {
          p_tailor_id: input.tailorId,
          p_amount: input.amount,
          p_entry_on: input.entryOn,
          p_notes: input.notes,
          p_confirmed: input.confirmed,
          p_override_reason: input.reason,
        })
        .single(),
    )
    return { id: created.id }
  },
})

const updateEntry = defineAction({
  input: z.object({ id: uuid, amount, entryOn: z.string().date(), notes, reason }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('update_cash_advance_entry', {
        p_entry_id: input.id,
        p_amount: input.amount,
        p_entry_on: input.entryOn,
        p_notes: input.notes,
        p_reason: input.reason,
      }),
    )
    return { id: input.id }
  },
})

const deleteEntry = defineAction({
  input: z.object({ id: uuid, reason: z.string().trim().min(1).max(200) }),
  run: async ({ id, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('delete_cash_advance_entry', { p_entry_id: id, p_reason: reason }))
    return { id }
  },
})

serveActions({
  overview,
  ledger,
  record_advance: recordAdvance,
  record_repayment: recordRepayment,
  update_entry: updateEntry,
  delete_entry: deleteEntry,
})
