import { z } from 'npm:zod@4'
import { defineAction, Rejection, serveActions, unwrap } from '../_shared/actions.ts'
import { createUserClient } from '../_shared/supabase.ts'

const categories = ['S', 'M', 'L'] as const
const optionalId = z.string().uuid().nullable().default(null)

interface ProductRow {
  id: string
  code: string
  name: string | null
  wage_category: (typeof categories)[number] | null
  is_active: boolean
}

interface FabricRow {
  id: string
  name: string
  is_active: boolean
  fabric_colors: { id: string; name: string; is_active: boolean }[]
}

interface SizeRow {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

interface WageRateRow {
  id: string
  wage_category: (typeof categories)[number]
  amount: number
  effective_from: string
}

function todayInJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

const overview = defineAction({
  input: z.object({}),
  run: async (_input, request) => {
    const supabase = createUserClient(request)
    const [products, fabrics, sizes, rates] = await Promise.all([
      supabase.from('products').select('id, code, name, wage_category, is_active').order('code'),
      supabase.from('fabrics').select('id, name, is_active, fabric_colors(id, name, is_active)').order('name'),
      supabase.from('sizes').select('id, name, sort_order, is_active').order('sort_order').order('name'),
      supabase
        .from('wage_rates')
        .select('id, wage_category, amount, effective_from')
        .order('effective_from', { ascending: false }),
    ])

    const today = todayInJakarta()
    const rateRows = unwrap<WageRateRow[]>(rates)

    return {
      products: unwrap<ProductRow[]>(products).map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.wage_category,
        isActive: product.is_active,
      })),
      fabrics: unwrap<FabricRow[]>(fabrics).map((fabric) => ({
        id: fabric.id,
        name: fabric.name,
        isActive: fabric.is_active,
        colors: fabric.fabric_colors
          .map((color) => ({ id: color.id, name: color.name, isActive: color.is_active }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
      sizes: unwrap<SizeRow[]>(sizes).map((size) => ({
        id: size.id,
        name: size.name,
        sortOrder: size.sort_order,
        isActive: size.is_active,
      })),
      wageRates: categories.map((category) => {
        const history = rateRows.filter((rate) => rate.wage_category === category)
        const current = history.find((rate) => rate.effective_from <= today) ?? null
        return {
          category,
          current: current ? { amount: Number(current.amount), effectiveFrom: current.effective_from } : null,
          history: history.map((rate) => ({
            id: rate.id,
            amount: Number(rate.amount),
            effectiveFrom: rate.effective_from,
            isFuture: rate.effective_from > today,
            isCurrent: rate.id === current?.id,
          })),
        }
      }),
    }
  },
})

const saveProduct = defineAction({
  input: z.object({
    id: optionalId,
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().max(80).nullable().default(null),
    category: z.enum(categories).nullable().default(null),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, code, name, category, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { code, name: name || null, wage_category: category, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('products').update(row).eq('id', id).select('id').single()
        : await supabase.from('products').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const saveFabric = defineAction({
  input: z.object({
    id: optionalId,
    name: z.string().trim().min(1).max(60),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, name, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { name, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('fabrics').update(row).eq('id', id).select('id').single()
        : await supabase.from('fabrics').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const saveColor = defineAction({
  input: z.object({
    id: optionalId,
    fabricId: z.string().uuid(),
    name: z.string().trim().min(1).max(40),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, fabricId, name, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { fabric_id: fabricId, name, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('fabric_colors').update(row).eq('id', id).select('id').single()
        : await supabase.from('fabric_colors').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const saveSize = defineAction({
  input: z.object({
    id: optionalId,
    name: z.string().trim().min(1).max(30),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, name, sortOrder, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { name, sort_order: sortOrder, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('sizes').update(row).eq('id', id).select('id').single()
        : await supabase.from('sizes').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const addWageRate = defineAction({
  input: z.object({
    category: z.enum(categories),
    amount: z.number().int().positive().max(10_000_000),
    effectiveFrom: z.string().date(),
  }),
  run: async ({ category, amount, effectiveFrom }, request) => {
    const supabase = createUserClient(request)
    const saved = unwrap(
      await supabase
        .from('wage_rates')
        .insert({ wage_category: category, amount, effective_from: effectiveFrom })
        .select('id')
        .single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const deletableTables = {
  product: 'products',
  fabric: 'fabrics',
  color: 'fabric_colors',
  size: 'sizes',
  wage_rate: 'wage_rates',
} as const

const remove = defineAction({
  input: z.object({
    kind: z.enum(['product', 'fabric', 'color', 'size', 'wage_rate']),
    id: z.string().uuid(),
  }),
  run: async ({ kind, id }, request) => {
    const supabase = createUserClient(request)
    if (kind === 'fabric') {
      const usage = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('fabric_id', id)
      if ((usage.count ?? 0) > 0) throw new Rejection('IN_USE', 409)
      unwrap(await supabase.from('fabric_colors').delete().eq('fabric_id', id))
    }
    const deleted = unwrap(
      await supabase.from(deletableTables[kind]).delete().eq('id', id).select('id'),
    ) as { id: string }[]
    if (deleted.length === 0) throw new Rejection(kind === 'wage_rate' ? 'RATE_ALREADY_ACTIVE' : 'NOT_FOUND')
    return { id }
  },
})

serveActions({
  overview,
  save_product: saveProduct,
  save_fabric: saveFabric,
  save_color: saveColor,
  save_size: saveSize,
  add_wage_rate: addWageRate,
  remove,
})
