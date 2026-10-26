import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'

const statusValues = ['draft', 'cutting', 'sewing', 'done', 'cancelled'] as const
const uuid = z.string().uuid()
const photoBucket = 'work-order-photos'
const photoExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const

interface NamedRef {
  name: string
}

interface WorkOrderRow {
  id: string
  number: string
  ordered_on: string
  pattern_id: string | null
  fabric_combination_id: string | null
  change_status: 'changed' | 'follow_sample'
  change_notes: string | null
  additional_info: string | null
  sample_photo_public_id: string | null
  status: (typeof statusValues)[number]
  created_at: string
  product_id: string
  fabric_id: string
  fabric_series_id: string | null
  cutter_id: string
  products: { code: string; name: string | null; wage_category: 'S' | 'M' | 'L' | null } | null
  fabric: NamedRef | null
  series: NamedRef | null
  combination: NamedRef | null
  patterns: { code: string } | null
  cutters: NamedRef | null
  work_order_sizes: { sizes: { name: string; sort_order: number } | null }[]
  work_order_items: {
    id: string
    cut_quantity: number | null
    size_id: string
    fabric_color_id: string | null
    sizes: { name: string; sort_order: number } | null
    fabric_colors: NamedRef | null
    sewing_cards: { quantity: number; status: string }[]
  }[]
}

const workOrderSelect = `
  id, number, ordered_on, pattern_id, fabric_combination_id, change_status, change_notes,
  additional_info, sample_photo_public_id, status, created_at, product_id, fabric_id, cutter_id,
  products(code, name, wage_category), patterns(code), cutters(name),
  fabric_series_id, series:fabric_series(name),
  fabric:fabrics!work_orders_fabric_id_fkey(name),
  combination:fabrics!work_orders_fabric_combination_id_fkey(name),
  work_order_sizes(sizes(name, sort_order)),
  work_order_items(id, cut_quantity, size_id, fabric_color_id, sizes(name, sort_order), fabric_colors(name),
    sewing_cards(quantity, status))
`

function shape(row: WorkOrderRow) {
  const items = row.work_order_items
    .map((item) => {
      const liveCards = item.sewing_cards.filter((card) => card.status !== 'cancelled')
      return {
        id: item.id,
        sizeId: item.size_id,
        sizeName: item.sizes?.name ?? '-',
        sizeOrder: item.sizes?.sort_order ?? 0,
        colorId: item.fabric_color_id,
        colorName: item.fabric_colors?.name ?? null,
        cutQuantity: item.cut_quantity,
        assignedQuantity: liveCards.reduce((sum, card) => sum + card.quantity, 0),
        submittedQuantity: liveCards
          .filter((card) => card.status === 'submitted' || card.status === 'paid')
          .reduce((sum, card) => sum + card.quantity, 0),
        cardCount: liveCards.length,
      }
    })
    .sort((a, b) => a.sizeOrder - b.sizeOrder || (a.colorName ?? '').localeCompare(b.colorName ?? ''))

  const unique = (values: string[]) => [...new Set(values)]
  const sizes = [
    ...row.work_order_sizes.flatMap((planned) => (planned.sizes ? [planned.sizes] : [])),
    ...items.map((item) => ({ name: item.sizeName, sort_order: item.sizeOrder })),
  ].sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: row.id,
    number: row.number,
    orderedOn: row.ordered_on,
    status: row.status,
    productId: row.product_id,
    productCode: row.products?.code ?? '-',
    productName: row.products?.name ?? null,
    category: row.products?.wage_category ?? null,
    fabricId: row.fabric_id,
    fabricName: row.fabric?.name ?? '-',
    seriesId: row.fabric_series_id,
    seriesName: row.series?.name ?? null,
    fabricCombinationId: row.fabric_combination_id,
    fabricCombination: row.combination?.name ?? null,
    cutterId: row.cutter_id,
    cutterName: row.cutters?.name ?? '-',
    patternId: row.pattern_id,
    patternCode: row.patterns?.code ?? null,
    changeStatus: row.change_status,
    changeNotes: row.change_notes,
    additionalInfo: row.additional_info,
    sizes: unique(sizes.map((size) => size.name)),
    colors: unique(items.flatMap((item) => (item.colorName ? [item.colorName] : []))).sort(),
    items,
    totals: {
      cut: items.reduce((sum, item) => sum + (item.cutQuantity ?? 0), 0),
      assigned: items.reduce((sum, item) => sum + item.assignedQuantity, 0),
      submitted: items.reduce((sum, item) => sum + item.submittedQuantity, 0),
    },
    hasCards: items.some((item) => item.cardCount > 0),
    hasPhoto: row.sample_photo_public_id !== null,
    photoUrl: null as string | null,
  }
}

async function withPhotoUrl(row: WorkOrderRow) {
  const workOrder = shape(row)
  if (!row.sample_photo_public_id) return workOrder
  const { data } = await createAdminClient()
    .storage.from(photoBucket)
    .createSignedUrl(row.sample_photo_public_id, 60 * 60)
  return { ...workOrder, photoUrl: data?.signedUrl ?? null }
}

async function removePhotoObject(path: string | null) {
  if (!path) return
  const { error } = await createAdminClient().storage.from(photoBucket).remove([path])
  if (error) console.error(error)
}

const PAGE_SIZE = 20

const list = defineAction({
  input: z.object({
    status: z.enum([...statusValues, 'active', 'all']).default('active'),
    search: z.string().trim().max(60).default(''),
    fabricId: uuid.nullable().default(null),
    cutterId: uuid.nullable().default(null),
    category: z.enum(['S', 'M', 'L']).nullable().default(null),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(1000).default(PAGE_SIZE),
  }),
  run: async ({ status, search, fabricId, cutterId, category, page, pageSize }, request) => {
    const supabase = createUserClient(request)
    const productIds = category
      ? unwrap<{ id: string }[]>(
          await supabase.from('products').select('id').eq('wage_category', category),
        ).map((product) => product.id)
      : null

    // Every filter except the status tab, so each tab can show its own count.
    // deno-lint-ignore no-explicit-any
    const filtered = (query: any) => {
      let next = query
      if (search) next = next.ilike('number', `%${search}%`)
      if (fabricId) next = next.eq('fabric_id', fabricId)
      if (cutterId) next = next.eq('cutter_id', cutterId)
      if (productIds) next = next.in('product_id', productIds.length > 0 ? productIds : [crypto.randomUUID()])
      return next
    }
    // deno-lint-ignore no-explicit-any
    const byStatus = (query: any, value: typeof status) =>
      value === 'all'
        ? query
        : value === 'active'
          ? query.not('status', 'in', '(done,cancelled)')
          : query.eq('status', value)
    const count = async (value: typeof status) => {
      const { count: total, error } = await byStatus(
        filtered(supabase.from('work_orders').select('id', { count: 'exact', head: true })),
        value,
      )
      if (error) throw new Rejection('UNKNOWN', 500)
      return total ?? 0
    }

    const from = (page - 1) * pageSize
    const [rows, ...counts] = await Promise.all([
      byStatus(filtered(supabase.from('work_orders').select(workOrderSelect, { count: 'exact' })), status)
        .order('ordered_on', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1),
      count('active'),
      count('done'),
      count('cancelled'),
      count('all'),
    ])
    const [active, done, cancelled, all] = counts
    return {
      summary: { active, done, cancelled, all },
      total: rows.count ?? 0,
      page,
      pageSize,
      workOrders: unwrap<WorkOrderRow[]>(rows).map(shape),
    }
  },
})

const get = defineAction({
  input: z.object({ id: uuid }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    const row = unwrap<WorkOrderRow | null>(
      await supabase.from('work_orders').select(workOrderSelect).eq('id', id).maybeSingle(),
    )
    if (!row) throw new Rejection('NOT_FOUND', 404)
    return withPhotoUrl(row)
  },
})

interface FabricOptionRow {
  id: string
  name: string
  kind: 'motif' | 'plain'
  code: string | null
  fabric_series: {
    id: string
    name: string
    is_active: boolean
    created_at: string
    fabric_colors: { id: string; name: string; is_active: boolean }[]
  }[]
}

const formOptions = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const [products, fabrics, sizes, cutters, patterns] = await Promise.all([
      supabase
        .from('products')
        .select('id, code, name, wage_category, default_pattern_id')
        .eq('is_active', true)
        .order('code'),
      supabase
        .from('fabrics')
        .select('id, name, kind, code, fabric_series(id, name, is_active, created_at, fabric_colors(id, name, is_active))')
        .eq('is_active', true)
        .order('name'),
      supabase.from('sizes').select('id, name').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('cutters').select('id, name').eq('is_active', true).is('archived_at', null).order('name'),
      supabase.from('patterns').select('id, code').eq('is_active', true).order('code'),
    ])
    return {
      products: unwrap<
        {
          id: string
          code: string
          name: string | null
          wage_category: 'S' | 'M' | 'L' | null
          default_pattern_id: string | null
        }[]
      >(products).map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.wage_category,
        defaultPatternId: product.default_pattern_id,
      })),
      fabrics: unwrap<FabricOptionRow[]>(fabrics).map((fabric) => ({
        id: fabric.id,
        name: fabric.name,
        kind: fabric.kind,
        code: fabric.code,
        colors: [
          ...new Map(
            fabric.fabric_series
              .filter((series) => series.is_active)
              .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name))
              .flatMap((series) => series.fabric_colors.filter((color) => color.is_active))
              .map((color) => [keyOf(color.name), { id: color.id, name: color.name }] as const)
              .reverse(),
          ).values(),
        ].sort((a, b) => a.name.localeCompare(b.name)),
      })),
      sizes: unwrap<{ id: string; name: string }[]>(sizes),
      cutters: unwrap<{ id: string; name: string }[]>(cutters),
      patterns: unwrap<{ id: string; code: string }[]>(patterns),
    }
  },
})

const suggestNumber = defineAction({
  input: z.object({ product: z.string().trim().min(1).max(40) }),
  run: async ({ product }, request) => {
    const supabase = createUserClient(request)
    return {
      number: unwrap<string>(await supabase.rpc('suggest_work_order_number_for_label', { p_label: product })),
    }
  },
})

const label = (max: number) => z.string().trim().min(1).max(max)
const optionalLabel = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => value || null)

const formInput = {
  number: z.string().trim().min(1).max(60),
  orderedOn: z.string().date(),
  product: label(40),
  category: z.enum(['S', 'M', 'L']).nullable().default(null),
  fabric: label(60),
  fabricCode: optionalLabel(20),
  cutter: label(60),
  pattern: optionalLabel(40),
  combination: optionalLabel(60),
  changeStatus: z.enum(['changed', 'follow_sample']),
  changeNotes: z.string().trim().max(1000).nullable().default(null),
  additionalInfo: z.string().trim().max(1000).nullable().default(null),
}

function keyOf(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// One RPC resolves every typed label (adding missing master data) and saves the WO in a single round trip.
const create = defineAction({
  input: z.object({
    ...formInput,
    sizes: z.array(label(30)).min(1).max(30),
    colors: z.array(label(40)).max(60).default([]),
    confirmed: z.boolean().default(false),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async ({ confirmed, reason, ...input }, request) => {
    const supabase = createUserClient(request)
    const id = unwrap<string>(
      await supabase.rpc('save_work_order', {
        p_work_order_id: null,
        p: input,
        p_confirmed: confirmed,
        p_override_reason: reason,
      }),
    )
    return { id }
  },
})

const update = defineAction({
  input: z.object({ id: uuid, ...formInput }),
  run: async ({ id, ...input }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('save_work_order', { p_work_order_id: id, p: input }))
    return { id }
  },
})

const addItems = defineAction({
  input: z.object({
    id: uuid,
    sizes: z.array(label(30)).min(1).max(30),
    colors: z.array(label(40)).max(60).default([]),
  }),
  run: async ({ id, sizes, colors }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('add_work_order_labels', { p_work_order_id: id, p_sizes: sizes, p_colors: colors }))
    return { id }
  },
})

const removeItem = defineAction({
  input: z.object({ itemId: uuid }),
  run: async ({ itemId }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('remove_work_order_item', { p_work_order_item_id: itemId }))
    return { id: itemId }
  },
})

const recordCut = defineAction({
  input: z.object({
    items: z
      .array(z.object({ workOrderItemId: uuid, cutQuantity: z.number().int().positive().max(100_000) }))
      .min(1),
  }),
  run: async ({ items }, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('record_cut_results', {
        p_items: items.map((item) => ({ work_order_item_id: item.workOrderItemId, cut_quantity: item.cutQuantity })),
      }),
    )
    return { count: items.length }
  },
})

const cancel = defineAction({
  input: z.object({ id: uuid, reason: z.string().trim().min(1).max(200) }),
  run: async ({ id, reason }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('cancel_work_order', { p_work_order_id: id, p_reason: reason }))
    return { id }
  },
})

const remove = defineAction({
  input: z.object({ id: uuid, reason: z.string().trim().max(200).default('Dihapus') }),
  run: async ({ id, reason }, request) => {
    const supabase = createUserClient(request)
    const current = unwrap<{ sample_photo_public_id: string | null } | null>(
      await supabase.from('work_orders').select('sample_photo_public_id').eq('id', id).maybeSingle(),
    )
    unwrap(await supabase.rpc('delete_work_order', { p_work_order_id: id, p_reason: reason }))
    await removePhotoObject(current?.sample_photo_public_id ?? null)
    return { id }
  },
})

const forceDelete = defineAction({
  input: z.object({ id: uuid, reason: z.string().trim().min(1).max(200) }),
  run: async ({ id, reason }, request) => {
    const supabase = createUserClient(request)
    const current = unwrap<{ sample_photo_public_id: string | null } | null>(
      await supabase.from('work_orders').select('sample_photo_public_id').eq('id', id).maybeSingle(),
    )
    unwrap(await supabase.rpc('force_delete_work_order', { p_work_order_id: id, p_reason: reason }))
    await removePhotoObject(current?.sample_photo_public_id ?? null)
    return { id }
  },
})

const printData = defineAction({
  input: z.object({ id: uuid }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    const [row, settings] = await Promise.all([
      supabase.from('work_orders').select(workOrderSelect).eq('id', id).maybeSingle(),
      supabase
        .from('print_settings')
        .select('offset_top_mm, offset_left_mm')
        .eq('document_type', 'work_order_card')
        .maybeSingle(),
    ])
    const workOrder = unwrap<WorkOrderRow | null>(row)
    if (!workOrder) throw new Rejection('NOT_FOUND', 404)
    const offsets = unwrap<{ offset_top_mm: number; offset_left_mm: number } | null>(settings)
    return {
      workOrder: await withPhotoUrl(workOrder),
      offsets: { top: Number(offsets?.offset_top_mm ?? 0), left: Number(offsets?.offset_left_mm ?? 0) },
    }
  },
})

interface ThpCardRow {
  number: string
  quantity: number
  taken_on: string
  submitted_on: string | null
  status: string
  submitted_incomplete: boolean
  remaining_notes: string | null
  tailors: { code: string; name: string } | null
  work_order_items: { sizes: { name: string; sort_order: number } | null } | null
  inspections: { round: number; ok_quantity: number; defective_quantity: number; notes: string | null }[]
}

/** THP (tanda hasil produksi): one sheet per size listing who took which card, for signing off. */
const thpData = defineAction({
  input: z.object({ id: uuid }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    const [row, cards] = await Promise.all([
      supabase.from('work_orders').select(workOrderSelect).eq('id', id).maybeSingle(),
      supabase
        .from('sewing_cards')
        .select(
          `number, quantity, taken_on, submitted_on, status, submitted_incomplete, remaining_notes,
          tailors(code, name), work_order_items!inner(work_order_id, sizes(name, sort_order)),
          inspections(round, ok_quantity, defective_quantity, notes)`,
        )
        .eq('work_order_items.work_order_id', id)
        .neq('status', 'cancelled')
        .order('number'),
    ])
    const workOrder = unwrap<WorkOrderRow | null>(row)
    if (!workOrder) throw new Rejection('NOT_FOUND', 404)
    const shaped = shape(workOrder)

    const sizes = new Map<string, { name: string; order: number; rows: unknown[] }>()
    for (const card of unwrap<ThpCardRow[]>(cards)) {
      const name = card.work_order_items?.sizes?.name ?? '-'
      const size = sizes.get(name) ?? { name, order: card.work_order_items?.sizes?.sort_order ?? 0, rows: [] }
      sizes.set(name, size)
      const isSubmitted = card.status === 'submitted' || card.status === 'paid'
      const checks = [...card.inspections].sort((a, b) => a.round - b.round)
      const notes = [
        card.submitted_incomplete && card.remaining_notes ? `Kurang: ${card.remaining_notes}` : null,
        ...checks.map((check) => check.notes),
      ].filter(Boolean)
      size.rows.push({
        cardNumber: card.number,
        tailorName: card.tailors?.name ?? null,
        tailorCode: card.tailors?.code ?? null,
        quantity: card.quantity,
        takenOn: card.taken_on,
        submittedOn: isSubmitted ? card.submitted_on : null,
        receivedQuantity: isSubmitted ? card.quantity : null,
        okQuantity: checks.length > 0 ? checks.reduce((sum, check) => sum + check.ok_quantity, 0) : null,
        defectiveQuantity:
          checks.length > 0 ? checks.reduce((sum, check) => sum + check.defective_quantity, 0) : null,
        notes: notes.length > 0 ? notes.join('; ') : null,
      })
    }

    return {
      workOrder: {
        number: shaped.number,
        productCode: shaped.productCode,
        orderedOn: shaped.orderedOn,
        cutterName: shaped.cutterName,
        fabricName: shaped.fabricName,
        fabricCombination: shaped.fabricCombination,
      },
      sizes: [...sizes.values()]
        .sort((a, b) => a.order - b.order)
        .map((size) => ({ name: size.name, rows: size.rows })),
    }
  },
})

const photoUploadUrl = defineAction({
  input: z.object({ id: uuid, contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) }),
  run: async ({ id, contentType }, request) => {
    const supabase = createUserClient(request)
    unwrap(await supabase.rpc('assert_work_order_photo_editable', { p_work_order_id: id }))
    const path = `${id}/${crypto.randomUUID()}.${photoExtensions[contentType]}`
    const { data, error } = await createAdminClient().storage.from(photoBucket).createSignedUploadUrl(path)
    if (error || !data) throw new Rejection('PHOTO_STORAGE_FAILED', 502)
    return { bucket: photoBucket, path: data.path, token: data.token }
  },
})

const setPhoto = defineAction({
  input: z.object({ id: uuid, path: z.string().max(200) }),
  run: async ({ id, path }, request) => {
    const fileName = path.slice(id.length + 1)
    if (!path.startsWith(`${id}/`) || fileName === '' || fileName.includes('/')) {
      throw new Rejection('WORK_ORDER_PHOTO_INVALID')
    }
    const stored = await createAdminClient().storage.from(photoBucket).list(id, { search: fileName })
    if (!stored.data?.some((object) => object.name === fileName)) throw new Rejection('WORK_ORDER_PHOTO_INVALID')
    const supabase = createUserClient(request)
    const previous = unwrap<string | null>(
      await supabase.rpc('set_work_order_photo', { p_work_order_id: id, p_path: path }),
    )
    if (previous !== path) await removePhotoObject(previous)
    return { id }
  },
})

const removePhoto = defineAction({
  input: z.object({ id: uuid }),
  run: async ({ id }, request) => {
    const supabase = createUserClient(request)
    const previous = unwrap<string | null>(
      await supabase.rpc('set_work_order_photo', { p_work_order_id: id, p_path: null }),
    )
    await removePhotoObject(previous)
    return { id }
  },
})

serveActions({
  list,
  get,
  form_options: formOptions,
  suggest_number: suggestNumber,
  create,
  update,
  add_items: addItems,
  remove_item: removeItem,
  record_cut: recordCut,
  cancel,
  delete: remove,
  force_delete: forceDelete,
  print: printData,
  thp: thpData,
  photo_upload_url: photoUploadUrl,
  set_photo: setPhoto,
  remove_photo: removePhoto,
})
