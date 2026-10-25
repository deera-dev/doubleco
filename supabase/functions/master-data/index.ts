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
  default_pattern_id: string | null
  is_active: boolean
}

interface PatternRow {
  id: string
  code: string
  notes: string | null
  is_active: boolean
}

interface FabricRow {
  id: string
  name: string
  is_active: boolean
  fabric_series: {
    id: string
    name: string
    is_active: boolean
    created_at: string
    fabric_colors: { id: string; name: string; is_active: boolean }[]
  }[]
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
    const [products, fabrics, sizes, rates, patterns] = await Promise.all([
      supabase.from('products').select('id, code, name, wage_category, default_pattern_id, is_active').order('code'),
      supabase
        .from('fabrics')
        .select('id, name, is_active, fabric_series(id, name, is_active, created_at, fabric_colors(id, name, is_active))')
        .order('name'),
      supabase.from('sizes').select('id, name, sort_order, is_active').order('sort_order').order('name'),
      supabase
        .from('wage_rates')
        .select('id, wage_category, amount, effective_from')
        .order('effective_from', { ascending: false }),
      supabase.from('patterns').select('id, code, notes, is_active').order('code'),
    ])

    const today = todayInJakarta()
    const rateRows = unwrap<WageRateRow[]>(rates)

    return {
      products: unwrap<ProductRow[]>(products).map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.wage_category,
        defaultPatternId: product.default_pattern_id,
        isActive: product.is_active,
      })),
      patterns: unwrap<PatternRow[]>(patterns).map((pattern) => ({
        id: pattern.id,
        code: pattern.code,
        notes: pattern.notes,
        isActive: pattern.is_active,
      })),
      fabrics: unwrap<FabricRow[]>(fabrics).map((fabric) => ({
        id: fabric.id,
        name: fabric.name,
        isActive: fabric.is_active,
        series: fabric.fabric_series
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name))
          .map((series) => ({
            id: series.id,
            name: series.name,
            isActive: series.is_active,
            colors: series.fabric_colors
              .map((color) => ({ id: color.id, name: color.name, isActive: color.is_active }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          })),
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
    defaultPatternId: optionalId,
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, code, name, category, defaultPatternId, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = {
      code,
      name: name || null,
      wage_category: category,
      default_pattern_id: defaultPatternId,
      is_active: isActive,
    }
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

const saveSeries = defineAction({
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
        ? await supabase.from('fabric_series').update(row).eq('id', id).select('id').single()
        : await supabase.from('fabric_series').insert(row).select('id').single(),
    ) as { id: string }
    return { id: saved.id }
  },
})

const saveColor = defineAction({
  input: z.object({
    id: optionalId,
    seriesId: z.string().uuid(),
    name: z.string().trim().min(1).max(40),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, seriesId, name, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { series_id: seriesId, name, is_active: isActive }
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

const savePattern = defineAction({
  input: z.object({
    id: optionalId,
    code: z.string().trim().min(1).max(40),
    notes: z.string().trim().max(200).nullable().default(null),
    isActive: z.boolean().default(true),
  }),
  run: async ({ id, code, notes, isActive }, request) => {
    const supabase = createUserClient(request)
    const row = { code, notes: notes || null, is_active: isActive }
    const saved = unwrap(
      id
        ? await supabase.from('patterns').update(row).eq('id', id).select('id').single()
        : await supabase.from('patterns').insert(row).select('id').single(),
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
  series: 'fabric_series',
  size: 'sizes',
  pattern: 'patterns',
  wage_rate: 'wage_rates',
} as const

const remove = defineAction({
  input: z.object({
    kind: z.enum(['product', 'fabric', 'series', 'color', 'size', 'pattern', 'wage_rate']),
    id: z.string().uuid(),
  }),
  run: async ({ kind, id }, request) => {
    const supabase = createUserClient(request)
    if (kind === 'fabric') {
      const usage = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .or(`fabric_id.eq.${id},fabric_combination_id.eq.${id}`)
      if ((usage.count ?? 0) > 0) throw new Rejection('IN_USE', 409)
      unwrap(await supabase.from('fabric_colors').delete().eq('fabric_id', id))
      unwrap(await supabase.from('fabric_series').delete().eq('fabric_id', id))
    }
    if (kind === 'series') {
      const usage = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('fabric_series_id', id)
      if ((usage.count ?? 0) > 0) throw new Rejection('IN_USE', 409)
      unwrap(await supabase.from('fabric_colors').delete().eq('series_id', id))
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
  save_series: saveSeries,
  save_color: saveColor,
  save_size: saveSize,
  save_pattern: savePattern,
  add_wage_rate: addWageRate,
  remove,
})
