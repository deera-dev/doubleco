import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createUserClient } from '../_shared/supabase.ts'

const uuid = z.string().uuid()
const cardNumber = z.string().trim().toUpperCase().regex(/^KJ-\d{4}-\d{4,}$/)
const cardStatuses = ['taken', 'submitted', 'paid', 'cancelled'] as const

type SupabaseClient = ReturnType<typeof createUserClient>

interface CardRow {
  id: string
  number: string
  quantity: number
  taken_on: string
  status: (typeof cardStatuses)[number]
  wage_category: 'S' | 'M' | 'L'
  wage_amount: number
  print_count: number
  submitted_on: string | null
  submitted_at: string | null
  submitted_by: string | null
  submitted_incomplete: boolean
  remaining_notes: string | null
  inspection_status: 'pending' | 'in_repair' | 'done'
  tailors: { id: string; code: string; name: string } | null
  work_order_items: {
    id: string
    sizes: { name: string } | null
    fabric_colors: { name: string } | null
    work_orders: {
      id: string
      number: string
      products: { code: string; name: string | null } | null
      cutters: { name: string } | null
      fabric: { name: string } | null
    } | null
  } | null
}

const cardSelect = `
  id, number, quantity, taken_on, status, wage_category, wage_amount, print_count, submitted_on,
  submitted_at, submitted_by, submitted_incomplete, remaining_notes, inspection_status,
  tailors(id, code, name),
  work_order_items!inner(id, work_order_id, sizes(name), fabric_colors(name),
    work_orders(id, number, products(code, name), cutters(name), fabric:fabrics!work_orders_fabric_id_fkey(name)))
`

function shapeCard(row: CardRow) {
  const workOrder = row.work_order_items?.work_orders
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    quantity: row.quantity,
    takenOn: row.taken_on,
    submittedOn: row.submitted_on,
    submittedAt: row.submitted_at,
    submittedIncomplete: row.submitted_incomplete,
    remainingNotes: row.remaining_notes,
    inspectionStatus: row.inspection_status,
    category: row.wage_category,
    wageAmount: Number(row.wage_amount),
    printCount: row.print_count,
    tailorId: row.tailors?.id ?? null,
    tailorCode: row.tailors?.code ?? null,
    tailorName: row.tailors?.name ?? null,
    workOrderItemId: row.work_order_items?.id ?? '',
    sizeName: row.work_order_items?.sizes?.name ?? '-',
    colorName: row.work_order_items?.fabric_colors?.name ?? null,
    workOrderId: workOrder?.id ?? '',
    workOrderNumber: workOrder?.number ?? '-',
    productCode: workOrder?.products?.code ?? '-',
    productName: workOrder?.products?.name ?? null,
    cutterName: workOrder?.cutters?.name ?? '-',
    fabricName: workOrder?.fabric?.name ?? '-',
  }
}

function byTailorCode(a: { code: string }, b: { code: string }) {
  return a.code.localeCompare(b.code, 'id', { numeric: true })
}

interface BoardRow {
  id: string
  number: string
  ordered_on: string
  status: string
  products: { code: string; wage_category: 'S' | 'M' | 'L' | null } | null
  cutters: { name: string } | null
  work_order_items: {
    id: string
    cut_quantity: number | null
    sizes: { name: string; sort_order: number } | null
    fabric_colors: { name: string } | null
    sewing_cards: { quantity: number; status: string }[]
  }[]
}

function itemsOf(row: BoardRow) {
  return row.work_order_items
    .map((item) => {
      const assigned = item.sewing_cards
        .filter((card) => card.status !== 'cancelled')
        .reduce((sum, card) => sum + card.quantity, 0)
      return {
        id: item.id,
        sizeName: item.sizes?.name ?? '-',
        sizeOrder: item.sizes?.sort_order ?? 0,
        colorName: item.fabric_colors?.name ?? null,
        cut: item.cut_quantity,
        assigned,
        remaining: item.cut_quantity === null ? null : item.cut_quantity - assigned,
      }
    })
    .sort((a, b) => a.sizeOrder - b.sizeOrder || (a.colorName ?? '').localeCompare(b.colorName ?? ''))
}

const boardSelect = `
  id, number, ordered_on, status, products(code, wage_category), cutters(name),
  work_order_items(id, cut_quantity, sizes(name, sort_order), fabric_colors(name), sewing_cards(quantity, status))
`

const board = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const rows = unwrap<BoardRow[]>(
      await supabase
        .from('work_orders')
        .select(boardSelect)
        .not('status', 'in', '(done,cancelled)')
        .order('ordered_on', { ascending: false })
        .limit(200),
    )
    const workOrders = rows.map((row) => {
      const items = itemsOf(row)
      const cutItems = items.filter((item) => item.cut !== null)
      return {
        id: row.id,
        number: row.number,
        orderedOn: row.ordered_on,
        productCode: row.products?.code ?? '-',
        category: row.products?.wage_category ?? null,
        cutterName: row.cutters?.name ?? '-',
        cut: cutItems.reduce((sum, item) => sum + (item.cut ?? 0), 0),
        assigned: items.reduce((sum, item) => sum + item.assigned, 0),
        remaining: cutItems.reduce((sum, item) => sum + (item.remaining ?? 0), 0),
        cardableItems: cutItems.filter((item) => (item.remaining ?? 0) > 0).length,
        uncutItems: items.length - cutItems.length,
      }
    })
    return {
      readyToSplit: workOrders.filter((workOrder) => workOrder.remaining > 0),
      waitingForCut: workOrders.filter((workOrder) => workOrder.cut === 0),
    }
  },
})

const splitOptions = defineAction({
  input: z.object({ workOrderId: uuid }),
  run: async ({ workOrderId }, request) => {
    const supabase = createUserClient(request)
    const [row, tailors, openCards] = await Promise.all([
      supabase
        .from('work_orders')
        .select(`${boardSelect}, fabric:fabrics!work_orders_fabric_id_fkey(name)`)
        .eq('id', workOrderId)
        .maybeSingle(),
      supabase.from('tailors').select('id, code, name').eq('status', 'active').is('archived_at', null),
      supabase.from('sewing_cards').select('tailor_id').eq('status', 'taken'),
    ])
    const workOrder = unwrap<(BoardRow & { fabric: { name: string } | null }) | null>(row)
    if (!workOrder) throw new Rejection('NOT_FOUND', 404)
    const category = workOrder.products?.wage_category ?? null
    const rate = category
      ? unwrap<number | null>(await supabase.rpc('wage_rate_on', { category, on_date: today() }))
      : null
    const openByTailor = new Map<string, number>()
    for (const card of unwrap<{ tailor_id: string }[]>(openCards)) {
      openByTailor.set(card.tailor_id, (openByTailor.get(card.tailor_id) ?? 0) + 1)
    }

    return {
      workOrder: {
        id: workOrder.id,
        number: workOrder.number,
        status: workOrder.status,
        productCode: workOrder.products?.code ?? '-',
        category,
        cutterName: workOrder.cutters?.name ?? '-',
        fabricName: workOrder.fabric?.name ?? '-',
        wageRate: rate === null ? null : Number(rate),
      },
      items: itemsOf(workOrder).map(({ sizeOrder: _order, ...item }) => item),
      tailors: unwrap<{ id: string; code: string; name: string }[]>(tailors)
        .sort(byTailorCode)
        .map((tailor) => ({ ...tailor, openCards: openByTailor.get(tailor.id) ?? 0 })),
      today: today(),
    }
  },
})

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

async function describeTailors(supabase: SupabaseClient, rejection: Rejection): Promise<Rejection> {
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

const issue = defineAction({
  input: z.object({
    takenOn: z.string().date(),
    cards: z
      .array(
        z.object({
          workOrderItemId: uuid,
          tailorId: uuid.nullable().default(null),
          quantity: z.number().int().positive().max(100_000),
        }),
      )
      .min(1)
      .max(100),
    confirmed: z.boolean().default(false),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async ({ takenOn, cards, confirmed, reason }, request) => {
    const supabase = createUserClient(request)
    try {
      const created = unwrap<{ number: string }[]>(
        await supabase.rpc('issue_sewing_cards', {
          p_cards: cards.map((card) => ({
            work_order_item_id: card.workOrderItemId,
            tailor_id: card.tailorId,
            quantity: card.quantity,
          })),
          p_taken_on: takenOn,
          p_confirmed: confirmed,
          p_override_reason: reason,
        }),
      )
      return { numbers: created.map((card) => card.number) }
    } catch (error) {
      if (error instanceof Rejection) throw await describeTailors(supabase, error)
      throw error
    }
  },
})

/** Hasil potong in iketan: each bundle (size + pieces) becomes one card, issued right away. */
const recordBundles = defineAction({
  input: z.object({
    workOrderId: uuid,
    takenOn: z.string().date(),
    bundles: z
      .array(z.object({ size: z.string().trim().min(1).max(30), quantity: z.number().int().positive().max(10_000) }))
      .min(1)
      .max(200),
  }),
  run: async ({ workOrderId, takenOn, bundles }, request) => {
    const supabase = createUserClient(request)
    const created = unwrap<{ number: string }[]>(
      await supabase.rpc('record_bundles', {
        p_work_order_id: workOrderId,
        p_bundles: bundles,
        p_taken_on: takenOn,
      }),
    )
    return { numbers: created.map((card) => card.number) }
  },
})

/** One card per cut size × colour holding every piece that has no card yet. */
const issueForWorkOrder = defineAction({
  input: z.object({ workOrderId: uuid, takenOn: z.string().date() }),
  run: async ({ workOrderId, takenOn }, request) => {
    const supabase = createUserClient(request)
    const row = unwrap<BoardRow | null>(
      await supabase.from('work_orders').select(boardSelect).eq('id', workOrderId).maybeSingle(),
    )
    if (!row) throw new Rejection('NOT_FOUND', 404)
    const cards = itemsOf(row)
      .filter((item) => (item.remaining ?? 0) > 0)
      .map((item) => ({ work_order_item_id: item.id, quantity: item.remaining }))
    if (cards.length === 0) throw new Rejection('CARDS_REQUIRED')
    const created = unwrap<{ number: string }[]>(
      await supabase.rpc('issue_sewing_cards', { p_cards: cards, p_taken_on: takenOn }),
    )
    return { numbers: created.map((card) => card.number) }
  },
})

const list = defineAction({
  input: z.object({
    status: z.enum([...cardStatuses, 'all']).default('taken'),
    search: z.string().trim().max(60).default(''),
    workOrderId: uuid.nullable().default(null),
    tailorId: uuid.nullable().default(null),
    submittedOn: z.string().date().nullable().default(null),
    needsInspection: z.boolean().default(false),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(500).default(20),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    // Search reaches card numbers, tailors (code or name) and WO numbers in one filter.
    const needle = input.search.replace(/[,()%*]/g, ' ').trim()
    let searchFilter: string | null = null
    if (needle) {
      const [tailors, workOrders] = await Promise.all([
        supabase.from('tailors').select('id').or(`code.eq.${needle},name.ilike.%${needle}%`).limit(50),
        supabase.from('work_orders').select('work_order_items(id)').ilike('number', `%${needle}%`).limit(50),
      ])
      const tailorIds = unwrap<{ id: string }[]>(tailors).map((tailor) => tailor.id)
      const itemIds = unwrap<{ work_order_items: { id: string }[] }[]>(workOrders).flatMap((workOrder) =>
        workOrder.work_order_items.map((item) => item.id),
      )
      searchFilter = [
        `number.ilike.%${needle}%`,
        tailorIds.length > 0 ? `tailor_id.in.(${tailorIds.join(',')})` : null,
        itemIds.length > 0 ? `work_order_item_id.in.(${itemIds.join(',')})` : null,
      ]
        .filter(Boolean)
        .join(',')
    }

    // Every filter except the status tab, so each tab can show its own count.
    // deno-lint-ignore no-explicit-any
    const filtered = (query: any) => {
      let next = query
      if (input.workOrderId) next = next.eq('work_order_items.work_order_id', input.workOrderId)
      if (input.tailorId) next = next.eq('tailor_id', input.tailorId)
      if (input.submittedOn) next = next.eq('submitted_on', input.submittedOn)
      if (input.needsInspection) {
        next = next.in('status', ['submitted', 'paid']).in('inspection_status', ['pending', 'in_repair'])
      }
      if (searchFilter) next = next.or(searchFilter)
      return next
    }
    // deno-lint-ignore no-explicit-any
    const byStatus = (query: any, value: typeof input.status) =>
      value === 'all' ? query : query.eq('status', value)
    const count = async (value: typeof input.status) => {
      const { count: total, error } = await byStatus(
        filtered(supabase.from('sewing_cards').select('id, work_order_items!inner(id)', { count: 'exact', head: true })),
        value,
      )
      if (error) throw new Rejection('UNKNOWN', 500)
      return total ?? 0
    }

    const from = (input.page - 1) * input.pageSize
    const [rows, taken, submitted, paid, cancelled, all] = await Promise.all([
      byStatus(filtered(supabase.from('sewing_cards').select(cardSelect, { count: 'exact' })), input.status)
        .order('taken_on', { ascending: false })
        .order('number', { ascending: false })
        .range(from, from + input.pageSize - 1),
      count('taken'),
      count('submitted'),
      count('paid'),
      count('cancelled'),
      count('all'),
    ])
    return {
      summary: { taken, submitted, paid, cancelled, all },
      total: rows.count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
      cards: unwrap<CardRow[]>(rows).map(shapeCard),
    }
  },
})

const update = defineAction({
  input: z.object({
    number: cardNumber,
    quantity: z.number().int().positive().max(100_000).nullable().default(null),
    tailorId: uuid.nullable().default(null),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async ({ number, quantity, tailorId, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('update_sewing_card', {
        p_number: number,
        p_quantity: quantity,
        p_tailor_id: tailorId,
        p_reason: reason,
      }),
    )
    return { number }
  },
})

const cancel = defineAction({
  input: z.object({ number: cardNumber, reason: z.string().trim().min(1).max(200) }),
  run: async ({ number, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('cancel_sewing_card', { p_number: number, p_reason: reason }))
    return { number }
  },
})

const scanOptions = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const tailors = unwrap<{ id: string; code: string; name: string }[]>(
      await supabase.from('tailors').select('id, code, name').eq('status', 'active').is('archived_at', null),
    )
    return { tailors: tailors.sort(byTailorCode), today: today() }
  },
})

interface InspectionRow {
  id: string
  round: number
  inspected_on: string
  ok_quantity: number
  repairable_quantity: number
  defective_quantity: number
  notes: string | null
  deduction_proposals:
    | { amount: number; decision: 'pending' | 'deduct' | 'waive' }
    | { amount: number; decision: 'pending' | 'deduct' | 'waive' }[]
    | null
}

const lookup = defineAction({
  input: z.object({ number: cardNumber }),
  run: async ({ number }, request) => {
    const supabase = createUserClient(request)
    const row = unwrap<CardRow | null>(
      await supabase.from('sewing_cards').select(cardSelect).eq('number', number).maybeSingle(),
    )
    if (!row) throw new Rejection('CARD_NOT_FOUND', 404, { number })
    const [submittedBy, inspections] = await Promise.all([
      row.submitted_by
        ? supabase.rpc('visible_display_name', { p_profile_id: row.submitted_by })
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('inspections')
        .select(
          'id, round, inspected_on, ok_quantity, repairable_quantity, defective_quantity, notes, deduction_proposals(amount, decision)',
        )
        .eq('sewing_card_id', row.id)
        .order('round'),
    ])
    return {
      ...shapeCard(row),
      submittedByName: unwrap<string | null>(submittedBy),
      inspections: unwrap<InspectionRow[]>(inspections).map((inspection) => {
        const proposal = Array.isArray(inspection.deduction_proposals)
          ? inspection.deduction_proposals[0]
          : inspection.deduction_proposals
        return {
          id: inspection.id,
          round: inspection.round,
          inspectedOn: inspection.inspected_on,
          ok: inspection.ok_quantity,
          repairable: inspection.repairable_quantity,
          defective: inspection.defective_quantity,
          notes: inspection.notes,
          deductionAmount: proposal ? Number(proposal.amount) : null,
          deductionDecision: proposal?.decision ?? null,
        }
      }),
    }
  },
})

const submit = defineAction({
  input: z.object({
    number: cardNumber,
    tailorId: uuid.nullable().default(null),
    submittedOn: z.string().date(),
    incomplete: z.boolean().default(false),
    remainingNotes: z.string().trim().max(500).nullable().default(null),
    confirmed: z.boolean().default(false),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('submit_sewing_card', {
        p_number: input.number,
        p_submitted_on: input.submittedOn,
        p_incomplete: input.incomplete,
        p_remaining_notes: input.incomplete ? input.remainingNotes : null,
        p_confirmed: input.confirmed,
        p_override_reason: input.reason,
        p_tailor_id: input.tailorId,
      }),
    )
    return { number: input.number }
  },
})

const quantity = z.number().int().min(0).max(100_000)

const inspect = defineAction({
  input: z.object({
    number: cardNumber,
    ok: quantity,
    repairable: quantity,
    defective: quantity,
    notes: z.string().trim().max(500).nullable().default(null),
    inspectedOn: z.string().date(),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('record_inspection', {
        p_number: input.number,
        p_ok_quantity: input.ok,
        p_repairable_quantity: input.repairable,
        p_defective_quantity: input.defective,
        p_notes: input.notes,
        p_inspected_on: input.inspectedOn,
      }),
    )
    return { number: input.number }
  },
})

const deleteInspection = defineAction({
  input: z.object({ number: cardNumber, reason: z.string().trim().min(1).max(200) }),
  run: async ({ number, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('delete_last_inspection', { p_number: number, p_reason: reason }))
    return { number }
  },
})

const unsubmit = defineAction({
  input: z.object({ number: cardNumber, reason: z.string().trim().min(1).max(200) }),
  run: async ({ number, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('unsubmit_sewing_card', { p_number: number, p_reason: reason }))
    return { number }
  },
})

const printData = defineAction({
  input: z.object({ numbers: z.array(cardNumber).min(1).max(200) }),
  run: async ({ numbers }, request) => {
    const supabase = createUserClient(request)
    const [rows, settings] = await Promise.all([
      supabase.from('sewing_cards').select(cardSelect).in('number', numbers),
      supabase
        .from('print_settings')
        .select('offset_top_mm, offset_left_mm')
        .eq('document_type', 'sewing_card')
        .maybeSingle(),
    ])
    const cards = unwrap<CardRow[]>(rows).map(shapeCard)
    const order = new Map(numbers.map((value, index) => [value, index]))
    const offsets = unwrap<{ offset_top_mm: number; offset_left_mm: number } | null>(settings)
    return {
      cards: cards.sort((a, b) => (order.get(a.number) ?? 0) - (order.get(b.number) ?? 0)),
      missing: numbers.filter((value) => !cards.some((card) => card.number === value)),
      offsets: { top: Number(offsets?.offset_top_mm ?? 0), left: Number(offsets?.offset_left_mm ?? 0) },
    }
  },
})

const recordPrint = defineAction({
  input: z.object({ numbers: z.array(cardNumber).min(1).max(200) }),
  run: async ({ numbers }, request) => {
    const supabase = createUserClient(request)
    return { count: unwrap<number>(await supabase.rpc('record_card_print', { p_numbers: numbers })) }
  },
})

serveActions({
  board,
  split_options: splitOptions,
  issue,
  issue_for_work_order: issueForWorkOrder,
  record_bundles: recordBundles,
  list,
  update,
  cancel,
  print: printData,
  record_print: recordPrint,
  scan_options: scanOptions,
  lookup,
  submit,
  unsubmit,
  inspect,
  delete_inspection: deleteInspection,
})
