import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createUserClient } from '../_shared/supabase.ts'

const statusFilter = z.enum(['active', 'inactive', 'all']).default('active')
const typeFilter = z.enum(['tailor', 'cutter', 'all']).default('all')

const accountInput = z
  .object({
    type: z.enum(['bank', 'ewallet']),
    provider: z.string().trim().min(1),
    number: z.string().trim().min(1),
    holder: z.string().trim().min(1),
  })
  .nullable()

interface TailorRow {
  id: string
  code: string
  name: string
  phone: string | null
  notes: string | null
  status: 'active' | 'inactive'
  inactive_since: string | null
  tailor_payment_accounts: {
    account_type: 'bank' | 'ewallet'
    provider: string
    account_number: string
    account_holder: string
    is_active: boolean
  }[]
}

interface CutterRow {
  id: string
  name: string
  is_active: boolean
  inactive_since: string | null
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function purgeDate(inactiveSince: string | null, retentionDays: number): string | null {
  if (!inactiveSince) return null
  const purgeAt = new Date(new Date(inactiveSince).getTime() + retentionDays * DAY_IN_MS)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(purgeAt)
}

function compareCodes(a: string | null, b: string | null): number {
  const left = Number(a)
  const right = Number(b)
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right
  return (a ?? '').localeCompare(b ?? '')
}

const list = defineAction({
  input: z.object({
    status: statusFilter,
    type: typeFilter,
    search: z.string().trim().max(60).default(''),
  }),
  run: async ({ status, type, search }, request) => {
    const supabase = createUserClient(request)
    const purge = await supabase.rpc('purge_inactive_employees')
    if (purge.error && purge.error.message !== 'FORBIDDEN') unwrap(purge)

    const [tailors, cutters, balances, retention] = await Promise.all([
      supabase
        .from('tailors')
        .select(
          'id, code, name, phone, notes, status, inactive_since, tailor_payment_accounts(account_type, provider, account_number, account_holder, is_active)',
        )
        .is('archived_at', null),
      supabase.from('cutters').select('id, name, is_active, inactive_since').is('archived_at', null),
      supabase.from('tailor_advance_balances').select('tailor_id, balance'),
      supabase.rpc('employee_retention_days'),
    ])
    const retentionDays = Number(unwrap(retention))

    const balanceByTailor = new Map(
      unwrap(balances).map((row: { tailor_id: string; balance: number }) => [row.tailor_id, row.balance]),
    )

    const employees = [
      ...unwrap<TailorRow[]>(tailors).map((tailor) => {
        const account = tailor.tailor_payment_accounts.find((candidate) => candidate.is_active)
        return {
          id: tailor.id,
          type: 'tailor' as const,
          code: tailor.code,
          name: tailor.name,
          phone: tailor.phone,
          notes: tailor.notes,
          status: tailor.status,
          purgeOn: purgeDate(tailor.inactive_since, retentionDays),
          account: account
            ? {
                type: account.account_type,
                provider: account.provider,
                number: account.account_number,
                holder: account.account_holder,
              }
            : null,
          advanceBalance: Number(balanceByTailor.get(tailor.id) ?? 0),
        }
      }),
      ...unwrap<CutterRow[]>(cutters).map((cutter) => ({
        id: cutter.id,
        type: 'cutter' as const,
        code: null,
        name: cutter.name,
        phone: null,
        notes: null,
        status: cutter.is_active ? ('active' as const) : ('inactive' as const),
        purgeOn: purgeDate(cutter.inactive_since, retentionDays),
        account: null,
        advanceBalance: 0,
      })),
    ]

    const ofType = employees.filter((employee) => type === 'all' || employee.type === type)
    const needle = search.toLowerCase()
    const matches = ofType
      .filter((employee) => status === 'all' || employee.status === status)
      .filter(
        (employee) =>
          needle === '' ||
          employee.name.toLowerCase().includes(needle) ||
          (employee.code ?? '').toLowerCase() === needle,
      )
      .sort((a, b) =>
        a.type === b.type ? compareCodes(a.code, b.code) || a.name.localeCompare(b.name) : a.type === 'tailor' ? -1 : 1,
      )

    return {
      retentionDays,
      summary: {
        active: ofType.filter((employee) => employee.status === 'active').length,
        inactive: ofType.filter((employee) => employee.status === 'inactive').length,
        all: ofType.length,
      },
      employees: matches,
    }
  },
})

const saveTailor = defineAction({
  input: z.object({
    id: z.string().uuid().nullable().default(null),
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(20).nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null),
    account: accountInput,
    confirmed: z.boolean().default(false),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const saved = unwrap(
      await supabase.rpc('save_tailor', {
        p_tailor_id: input.id,
        p_code: input.code,
        p_name: input.name,
        p_phone: input.phone,
        p_notes: input.notes,
        p_account: input.account
          ? {
              account_type: input.account.type,
              provider: input.account.provider,
              account_number: input.account.number,
              account_holder: input.account.holder,
            }
          : {},
        p_confirmed: input.confirmed,
        p_override_reason: input.reason,
      }),
    )
    return { id: (saved as { id: string }).id }
  },
})

const setTailorStatus = defineAction({
  input: z.object({ id: z.string().uuid(), status: z.enum(['active', 'inactive']) }),
  run: async ({ id, status }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.from('tailors').update({ status }).eq('id', id).select('id').single())
    return { id }
  },
})

const setRetentionDays = defineAction({
  input: z.object({ days: z.number().int().min(7).max(3650) }),
  run: async ({ days }, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase
        .from('app_settings')
        .update({ value: days })
        .eq('key', 'employee_inactive_retention_days')
        .select('id')
        .single(),
    )
    return { days }
  },
})

const deleteTailor = defineAction({
  input: z.object({ id: z.string().uuid() }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    const usages = await Promise.all(
      [
        'sewing_cards',
        'cash_advance_entries',
        'payroll_lines',
        'deduction_proposals',
        'legacy_wage_records',
        'legacy_deposit_records',
      ].map((table) =>
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('tailor_id', id),
      ),
    )
    if (usages.some((usage) => (usage.count ?? 0) > 0)) throw new Rejection('IN_USE', 409)
    unwrap(await supabase.from('tailor_payment_accounts').delete().eq('tailor_id', id))
    unwrap(await supabase.from('tailors').delete().eq('id', id))
    return { id }
  },
})

const saveCutter = defineAction({
  input: z.object({
    id: z.string().uuid().nullable().default(null),
    name: z.string().trim().min(1).max(60),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, name, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { name, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('cutters').update(row).eq('id', id).select('id').single()
        : await supabase.from('cutters').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const deleteCutter = defineAction({
  input: z.object({ id: z.string().uuid() }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.from('cutters').delete().eq('id', id))
    return { id }
  },
})

serveActions({
  list,
  save_tailor: saveTailor,
  set_tailor_status: setTailorStatus,
  set_retention_days: setRetentionDays,
  delete_tailor: deleteTailor,
  save_cutter: saveCutter,
  delete_cutter: deleteCutter,
})
