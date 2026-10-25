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
  pattern_code: string | null
  fabric_combination: string | null
  change_status: 'changed' | 'follow_sample'
  change_notes: string | null
  additional_info: string | null
  sample_photo_public_id: string | null
  status: (typeof statusValues)[number]
  created_at: string
  product_id: string
  fabric_id: string
  cutter_id: string
  products: { code: string; name: string | null; wage_category: 'S' | 'M' | 'L' | null } | null
  fabrics: NamedRef | null
  cutters: NamedRef | null
  work_order_items: {
    id: string
    cut_quantity: number | null
    size_id: string
    fabric_color_id: string
    sizes: { name: string; sort_order: number } | null
    fabric_colors: NamedRef | null
    sewing_cards: { quantity: number; status: string }[]
  }[]
}

const workOrderSelect = `
  id, number, ordered_on, pattern_code, fabric_combination, change_status, change_notes,
  additional_info, sample_photo_public_id, status, created_at, product_id, fabric_id, cutter_id,
  products(code, name, wage_category), fabrics(name), cutters(name),
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
        colorName: item.fabric_colors?.name ?? '-',
        cutQuantity: item.cut_quantity,
        assignedQuantity: liveCards.reduce((sum, card) => sum + card.quantity, 0),
        submittedQuantity: liveCards
          .filter((card) => card.status === 'submitted' || card.status === 'paid')
          .reduce((sum, card) => sum + card.quantity, 0),
        cardCount: item.sewing_cards.length,
      }
    })
    .sort((a, b) => a.sizeOrder - b.sizeOrder || a.colorName.localeCompare(b.colorName))

  const unique = (values: string[]) => [...new Set(values)]

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
    fabricName: row.fabrics?.name ?? '-',
    fabricCombination: row.fabric_combination,
    cutterId: row.cutter_id,
    cutterName: row.cutters?.name ?? '-',
    patternCode: row.pattern_code,
    changeStatus: row.change_status,
    changeNotes: row.change_notes,
    additionalInfo: row.additional_info,
    sizes: unique(items.map((item) => item.sizeName)),
    colors: unique(items.map((item) => item.colorName)).sort(),
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

const list = defineAction({
  input: z.object({
    status: z.enum([...statusValues, 'active', 'all']).default('active'),
    search: z.string().trim().max(60).default(''),
  }),
  run: async ({ status, search }, request) => {
    const supabase = createUserClient(request)
    const rows = unwrap<WorkOrderRow[]>(
      await supabase
        .from('work_orders')
        .select(workOrderSelect)
        .order('ordered_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300),
    )
    const all = rows.map(shape)
    const needle = search.toLowerCase()
    const matchesStatus = (workOrder: ReturnType<typeof shape>) =>
      status === 'all' ||
      (status === 'active' ? !['done', 'cancelled'].includes(workOrder.status) : workOrder.status === status)

    return {
      summary: {
        active: all.filter((workOrder) => !['done', 'cancelled'].includes(workOrder.status)).length,
        draft: all.filter((workOrder) => workOrder.status === 'draft').length,
        cutting: all.filter((workOrder) => workOrder.status === 'cutting').length,
        sewing: all.filter((workOrder) => workOrder.status === 'sewing').length,
        done: all.filter((workOrder) => workOrder.status === 'done').length,
        cancelled: all.filter((workOrder) => workOrder.status === 'cancelled').length,
        all: all.length,
      },
      workOrders: all.filter(matchesStatus).filter(
        (workOrder) =>
          needle === '' ||
          workOrder.number.toLowerCase().includes(needle) ||
          workOrder.productCode.toLowerCase().includes(needle) ||
          workOrder.fabricName.toLowerCase().includes(needle) ||
          workOrder.cutterName.toLowerCase().includes(needle),
      ),
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

const formOptions = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const [products, fabrics, sizes, cutters] = await Promise.all([
      supabase.from('products').select('id, code, name, wage_category').eq('is_active', true).order('code'),
      supabase
        .from('fabrics')
        .select('id, name, fabric_colors(id, name, is_active)')
        .eq('is_active', true)
        .order('name'),
      supabase.from('sizes').select('id, name').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('cutters').select('id, name').eq('is_active', true).is('archived_at', null).order('name'),
    ])
    return {
      products: unwrap<{ id: string; code: string; name: string | null; wage_category: 'S' | 'M' | 'L' | null }[]>(
        products,
      ).map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.wage_category,
      })),
      fabrics: unwrap<{ id: string; name: string; fabric_colors: { id: string; name: string; is_active: boolean }[] }[]>(
        fabrics,
      ).map((fabric) => ({
        id: fabric.id,
        name: fabric.name,
        colors: fabric.fabric_colors
          .filter((color) => color.is_active)
          .map((color) => ({ id: color.id, name: color.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
      sizes: unwrap<{ id: string; name: string }[]>(sizes),
      cutters: unwrap<{ id: string; name: string }[]>(cutters),
    }
  },
})

const suggestNumber = defineAction({
  input: z.object({ productId: uuid }),
  run: async ({ productId }, request) => {
    const supabase = createUserClient(request)
    return { number: unwrap<string>(await supabase.rpc('suggest_work_order_number', { p_product_id: productId })) }
  },
})

const formInput = {
  number: z.string().trim().min(1).max(60),
  orderedOn: z.string().date(),
  productId: uuid,
  fabricId: uuid,
  cutterId: uuid,
  patternCode: z.string().trim().max(40).nullable().default(null),
  fabricCombination: z.string().trim().max(60).nullable().default(null),
  changeStatus: z.enum(['changed', 'follow_sample']),
  changeNotes: z.string().trim().max(1000).nullable().default(null),
  additionalInfo: z.string().trim().max(1000).nullable().default(null),
}

const create = defineAction({
  input: z.object({
    ...formInput,
    sizeIds: z.array(uuid).min(1),
    colorIds: z.array(uuid).min(1),
    confirmed: z.boolean().default(false),
    reason: z.string().trim().max(200).nullable().default(null),
  }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    const created = unwrap<{ id: string }>(
      await supabase
        .rpc('create_work_order', {
          p_product_id: input.productId,
          p_fabric_id: input.fabricId,
          p_cutter_id: input.cutterId,
          p_change_status: input.changeStatus,
          p_size_ids: input.sizeIds,
          p_fabric_color_ids: input.colorIds,
          p_number: input.number,
          p_ordered_on: input.orderedOn,
          p_pattern_code: input.patternCode,
          p_fabric_combination: input.fabricCombination,
          p_change_notes: input.changeNotes,
          p_additional_info: input.additionalInfo,
          p_confirmed: input.confirmed,
          p_override_reason: input.reason,
        })
        .single(),
    )
    return { id: created.id }
  },
})

const update = defineAction({
  input: z.object({ id: uuid, ...formInput }),
  run: async (input, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase
        .from('work_orders')
        .update({
          number: input.number,
          ordered_on: input.orderedOn,
          product_id: input.productId,
          fabric_id: input.fabricId,
          cutter_id: input.cutterId,
          pattern_code: input.patternCode || null,
          fabric_combination: input.fabricCombination || null,
          change_status: input.changeStatus,
          change_notes: input.changeStatus === 'changed' ? input.changeNotes || null : null,
          additional_info: input.additionalInfo || null,
        })
        .eq('id', input.id)
        .select('id')
        .single(),
    )
    return { id: input.id }
  },
})

const addItems = defineAction({
  input: z.object({ id: uuid, sizeIds: z.array(uuid).min(1), colorIds: z.array(uuid).min(1) }),
  run: async ({ id, sizeIds, colorIds }, request) => {
    const supabase = createUserClient(request)
    unwrap(
      await supabase.rpc('add_work_order_items', {
        p_work_order_id: id,
        p_size_ids: sizeIds,
        p_fabric_color_ids: colorIds,
      }),
    )
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
    const shaped = await withPhotoUrl(workOrder)
    const sumCut = (items: typeof shaped.items) =>
      items.some((item) => item.cutQuantity !== null)
        ? items.reduce((sum, item) => sum + (item.cutQuantity ?? 0), 0)
        : null
    return {
      workOrder: shaped,
      cutMatrix: {
        sizes: shaped.sizes,
        rows: shaped.colors.map((color) => {
          const items = shaped.items.filter((item) => item.colorName === color)
          return {
            color,
            cells: shaped.sizes.map((size) => {
              const item = items.find((candidate) => candidate.sizeName === size)
              return { planned: item !== undefined, quantity: item?.cutQuantity ?? null }
            }),
            total: sumCut(items),
          }
        }),
        total: sumCut(shaped.items),
      },
      offsets: { top: Number(offsets?.offset_top_mm ?? 0), left: Number(offsets?.offset_left_mm ?? 0) },
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
  print: printData,
  photo_upload_url: photoUploadUrl,
  set_photo: setPhoto,
  remove_photo: removePhoto,
})
