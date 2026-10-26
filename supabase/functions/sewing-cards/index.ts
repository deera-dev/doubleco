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
    submittedOn: z.string().date().nullable().default(null),
    needsInspection: z.boolean().default(false),
  }),
  run: async ({ status, search, workOrderId, submittedOn, needsInspection }, request) => {
    const supabase = createUserClient(request)
    let query = supabase
      .from('sewing_cards')
      .select(cardSelect)
      .order('taken_on', { ascending: false })
      .order('number', { ascending: false })
      .limit(500)
    if (workOrderId) query = query.eq('work_order_items.work_order_id', workOrderId)
    if (submittedOn) query = query.eq('submitted_on', submittedOn)
    if (needsInspection) {
      query = query.in('status', ['submitted', 'paid']).in('inspection_status', ['pending', 'in_repair'])
    }
    const all = unwrap<CardRow[]>(await query).map(shapeCard)
    const needle = search.toLowerCase()
    return {
      summary: {
        taken: all.filter((card) => card.status === 'taken').length,
        submitted: all.filter((card) => card.status === 'submitted').length,
        paid: all.filter((card) => card.status === 'paid').length,
        cancelled: all.filter((card) => card.status === 'cancelled').length,
        all: all.length,
      },
      cards: all
        .filter((card) => status === 'all' || card.status === status)
        .filter(
          (card) =>
            needle === '' ||
            card.number.toLowerCase().includes(needle) ||
            card.tailorCode?.toLowerCase() === needle ||
            card.tailorName?.toLowerCase().includes(needle) ||
            card.workOrderNumber.toLowerCase().includes(needle) ||
            card.productCode.toLowerCase().includes(needle),
        ),
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
