import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createUserClient } from '../_shared/supabase.ts'

type SupabaseClient = ReturnType<typeof createUserClient>

const uuid = z.string().uuid()
const saturday = z
  .string()
  .date()
  .refine((value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 6, 'PAY_DATE_NOT_SATURDAY')
const reason = z.string().trim().max(200).nullable().default(null)

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The Saturday that closes the current Monday–Saturday week (today when it is Saturday). */
function upcomingSaturday(): string {
  const now = today()
  const day = new Date(`${now}T00:00:00Z`).getUTCDay()
  return addDays(now, (6 - day + 7) % 7)
}

interface Account {
  provider: string
  account_number: string
  account_holder: string
  is_active: boolean
}

interface LineRow {
  id: string
  tailor_id: string
  gross_wage: number
  advance_repayment: number
  deduction_total: number
  addition_total: number
  new_advance_total: number
  transfer_amount: number
  account_provider: string | null
  account_number: string | null
  account_holder: string | null
  status: 'draft' | 'paid'
  paid_at: string | null
  tailors: { code: string; name: string; tailor_payment_accounts: Account[] } | null
  sewing_cards: {
    number: string
    quantity: number
    wage_amount: number
    wage_category: 'S' | 'M' | 'L'
    submitted_on: string | null
    submitted_incomplete: boolean
    work_order_items: {
      sizes: { name: string } | null
      fabric_colors: { name: string } | null
      work_orders: { products: { code: string } | null } | null
    } | null
  }[]
  payroll_additions: { id: string; kind: 'thr' | 'bonus' | 'other'; amount: number; notes: string | null }[]
  deduction_proposals: {
    id: string
    quantity: number
    amount: number
    inspections: { sewing_cards: { number: string } | null } | null
  }[]
  cash_advance_entries: { id: string; entry_type: string; amount: number; entry_on: string }[]
}

const lineSelect = `
  id, tailor_id, gross_wage, advance_repayment, deduction_total, addition_total, new_advance_total,
  transfer_amount, account_provider, account_number, account_holder, status, paid_at,
  tailors(code, name, tailor_payment_accounts(provider, account_number, account_holder, is_active)),
  sewing_cards(number, quantity, wage_amount, wage_category, submitted_on, submitted_incomplete,
    work_order_items(sizes(name), fabric_colors(name), work_orders(products(code)))),
  payroll_additions(id, kind, amount, notes),
  deduction_proposals(id, quantity, amount, inspections(sewing_cards(number))),
  cash_advance_entries(id, entry_type, amount, entry_on)
`

function shapeLine(row: LineRow, isLocked: boolean, balances: Map<string, number>) {
  const activeAccount = row.tailors?.tailor_payment_accounts.find((account) => account.is_active)
  const account = isLocked
    ? row.account_number
      ? { provider: row.account_provider ?? '', number: row.account_number, holder: row.account_holder ?? '' }
      : null
    : activeAccount
      ? {
          provider: activeAccount.provider,
          number: activeAccount.account_number,
          holder: activeAccount.account_holder,
        }
      : null
  const cards = row.sewing_cards
    .map((card) => ({
      number: card.number,
      quantity: card.quantity,
      wage: Number(card.wage_amount),
      category: card.wage_category,
      submittedOn: card.submitted_on,
      incomplete: card.submitted_incomplete,
      productCode: card.work_order_items?.work_orders?.products?.code ?? '-',
      sizeName: card.work_order_items?.sizes?.name ?? '-',
      colorName: card.work_order_items?.fabric_colors?.name ?? '-',
    }))
    .sort((a, b) => a.number.localeCompare(b.number))
  return {
    id: row.id,
    tailorId: row.tailor_id,
    code: row.tailors?.code ?? '-',
    name: row.tailors?.name ?? '-',
    account,
    grossWage: Number(row.gross_wage),
    advanceRepayment: Number(row.advance_repayment),
    deductionTotal: Number(row.deduction_total),
    additionTotal: Number(row.addition_total),
    newAdvanceTotal: Number(row.new_advance_total),
    transferAmount: Number(row.transfer_amount),
    // Before locking, the repayment is still to be taken from this balance.
    advanceBalance: balances.get(row.tailor_id) ?? 0,
    status: row.status,
    paidAt: row.paid_at,
    pieces: cards.reduce((sum, card) => sum + card.quantity, 0),
    cards,
    additions: row.payroll_additions.map((addition) => ({
      id: addition.id,
      kind: addition.kind,
      amount: Number(addition.amount),
      notes: addition.notes,
    })),
    deductions: row.deduction_proposals.map((deduction) => ({
      id: deduction.id,
      quantity: deduction.quantity,
      amount: Number(deduction.amount),
      cardNumber: deduction.inspections?.sewing_cards?.number ?? '-',
    })),
    newAdvances: row.cash_advance_entries
      .filter((entry) => entry.entry_type === 'advance')
      .map((entry) => ({ id: entry.id, amount: Number(entry.amount), entryOn: entry.entry_on })),
  }
}

interface PendingDeductionRow {
  id: string
  quantity: number
  amount: number
  created_at: string
  tailors: { code: string; name: string } | null
  inspections: {
    inspected_on: string
    notes: string | null
    sewing_cards: { number: string } | null
  } | null
}

async function pendingDeductions(supabase: SupabaseClient) {
  const rows = unwrap<PendingDeductionRow[]>(
    await supabase
      .from('deduction_proposals')
      .select('id, quantity, amount, created_at, tailors(code, name), inspections(inspected_on, notes, sewing_cards(number))')
      .eq('decision', 'pending')
      .order('created_at'),
  )
  return rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    amount: Number(row.amount),
    tailorCode: row.tailors?.code ?? '-',
    tailorName: row.tailors?.name ?? '-',
    cardNumber: row.inspections?.sewing_cards?.number ?? '-',
    inspectedOn: row.inspections?.inspected_on ?? null,
    notes: row.inspections?.notes ?? null,
  }))
}

const overview = defineAction({
  input: z.object({ payOn: saturday.nullable().default(null) }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const current = upcomingSaturday()
    const payOn = input.payOn ?? current
    let period = unwrap<{ id: string; status: 'open' | 'locked'; locked_at: string | null } | null>(
      await supabase.from('payroll_periods').select('id, status, locked_at').eq('pay_on', payOn).maybeSingle(),
    )
    // Rekap otomatis: an open week up to this Saturday picks up every card handed in so far.
    // A later week is never built ahead of time, or it would take this week's cards.
    if (payOn <= current && period?.status !== 'locked') {
      unwrap(await supabase.rpc('build_payroll', { p_pay_on: payOn }))
      period = unwrap(
        await supabase.from('payroll_periods').select('id, status, locked_at').eq('pay_on', payOn).maybeSingle(),
      )
    }

    const isLocked = period?.status === 'locked'
    const rows = period
      ? unwrap<LineRow[]>(await supabase.from('payroll_lines').select(lineSelect).eq('payroll_period_id', period.id))
      : []
    const tailorIds = rows.map((row) => row.tailor_id)
    const balances = new Map<string, number>()
    if (tailorIds.length > 0) {
      const balanceRows = unwrap<{ tailor_id: string; balance: number }[]>(
        await supabase.from('tailor_advance_balances').select('tailor_id, balance').in('tailor_id', tailorIds),
      )
      for (const row of balanceRows) balances.set(row.tailor_id, Number(row.balance))
    }
    const lines = rows
      .map((row) => shapeLine(row, isLocked, balances))
      .sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }))

    return {
      payOn,
      startsOn: addDays(payOn, -5),
      currentPayOn: current,
      isFuture: payOn > current,
      status: period ? period.status : 'open',
      lockedAt: period?.locked_at ?? null,
      lines,
      totals: {
        tailors: lines.length,
        cards: lines.reduce((sum, line) => sum + line.cards.length, 0),
        pieces: lines.reduce((sum, line) => sum + line.pieces, 0),
        grossWage: lines.reduce((sum, line) => sum + line.grossWage, 0),
        transfer: lines.reduce((sum, line) => sum + Math.max(line.transferAmount, 0), 0),
        paid: lines.filter((line) => line.status === 'paid').length,
      },
      pendingDeductions: await pendingDeductions(supabase),
    }
  },
})

const tailorOptions = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const tailors = unwrap<{ id: string; code: string; name: string }[]>(
      await supabase.from('tailors').select('id, code, name').eq('status', 'active').is('archived_at', null),
    )
    return { tailors: tailors.sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true })) }
  },
})

/** Warnings carry tailor ids; the confirm dialog needs names. */
async function withTailorNames(supabase: SupabaseClient, rejection: Rejection): Promise<Rejection> {
  const details = rejection.details as { warnings?: { tailor_id?: string }[] } | undefined
  const warnings = details?.warnings
  if (rejection.code !== 'CONFIRMATION_REQUIRED' || !warnings) return rejection
  const ids = [...new Set(warnings.map((warning) => warning.tailor_id).filter((id): id is string => !!id))]
  if (ids.length === 0) return rejection
  const { data } = await supabase.from('tailors').select('id, code, name').in('id', ids)
  const byId = new Map((data ?? []).map((tailor) => [tailor.id, tailor]))
  return new Rejection(rejection.code, rejection.status, {
    ...details,
    warnings: warnings.map((warning) => {
      const tailor = warning.tailor_id ? byId.get(warning.tailor_id) : undefined
      return tailor ? { ...warning, tailor_code: tailor.code, tailor_name: tailor.name } : warning
    }),
  })
}

const setRepayment = defineAction({
  input: z.object({
    lineId: uuid,
    amount: z.number().int().min(0).max(1_000_000_000),
    confirmed: z.boolean().default(false),
    reason,
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('set_payroll_repayment', {
        p_payroll_line_id: input.lineId,
        p_amount: input.amount,
        p_confirmed: input.confirmed,
        p_override_reason: input.reason,
      }),
    )
    return { id: input.lineId }
  },
})

const addAddition = defineAction({
  input: z.object({
    payOn: saturday,
    tailorId: uuid,
    kind: z.enum(['thr', 'bonus', 'other']),
    amount: z.number().int().positive().max(1_000_000_000),
    notes: z.string().trim().max(300).nullable().default(null),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const created = unwrap<{ id: string }>(
      await supabase
        .rpc('add_payroll_addition', {
          p_pay_on: input.payOn,
          p_tailor_id: input.tailorId,
          p_kind: input.kind,
          p_amount: input.amount,
          p_notes: input.notes,
        })
        .single(),
    )
    return { id: created.id }
  },
})

const removeAddition = defineAction({
  input: z.object({ id: uuid, reason }),
  run: async ({ id, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('remove_payroll_addition', { p_payroll_addition_id: id, p_reason: reason }))
    return { id }
  },
})

const lock = defineAction({
  input: z.object({ payOn: saturday, confirmed: z.boolean().default(false), reason }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    try {
      unwrap(
        await supabase.rpc('lock_payroll', {
          p_pay_on: input.payOn,
          p_confirmed: input.confirmed,
          p_override_reason: input.reason,
        }),
      )
    } catch (error) {
      if (error instanceof Rejection) throw await withTailorNames(supabase, error)
      throw error
    }
    return { payOn: input.payOn }
  },
})

const unlock = defineAction({
  input: z.object({ payOn: saturday, reason: z.string().trim().min(1).max(200) }),
  run: async ({ payOn, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('unlock_payroll', { p_pay_on: payOn, p_reason: reason }))
    return { payOn }
  },
})

const markPaid = defineAction({
  input: z.object({ lineId: uuid }),
  run: async ({ lineId }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('mark_payroll_line_paid', { p_payroll_line_id: lineId }))
    return { id: lineId }
  },
})

const decideDeduction = defineAction({
  input: z.object({
    id: uuid,
    decision: z.enum(['deduct', 'waive']),
    notes: z.string().trim().max(300).nullable().default(null),
  }),
  run: async ({ id, decision, notes }, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('decide_deduction', {
        p_deduction_proposal_id: id,
        p_decision: decision,
        p_notes: notes,
      }),
    )
    return { id }
  },
})

serveActions({
  overview,
  tailor_options: tailorOptions,
  set_repayment: setRepayment,
  add_addition: addAddition,
  remove_addition: removeAddition,
  lock,
  unlock,
  mark_paid: markPaid,
  decide_deduction: decideDeduction,
})
