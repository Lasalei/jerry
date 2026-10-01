// Per-product grid axes.
//
// Every product carries its own ordered list of field1 values (rows) and field2
// values (columns). The workspace config only supplies the field NAMES and the
// DEFAULT values that pre-fill a new product. This module resolves what a given
// product's grid actually is, including the legacy fallback for products saved
// before per-product axes existed.

import type { AppConfig, StockUnit, Style } from './types'

export interface Axes {
  /** Rows (field1 → `variant` column). */
  v1: string[]
  /** Columns (field2 → `size` column). `['']` in a single-field workspace. */
  v2: string[]
}

/** Stable key for one grid cell. Uses a control char so user values can't collide. */
export function cellKey(variant: string, size: string): string {
  return `${variant}\u001f${size}`
}

/**
 * The grid axes for one product.
 *
 * - Own values if set; otherwise the workspace defaults (pre-005 products).
 * - Single-field workspace, or a product that has switched the second field off
 *   (sizes = []) → one synthetic column keyed by ''.
 * - Any stock this product still holds under a value that isn't listed is appended,
 *   so the visible grid always accounts for the product's total.
 */
export function axesFor(
  style: Pick<Style, 'id' | 'variants' | 'sizes'>,
  stock: StockUnit[],
  config: AppConfig,
): Axes {
  const v1 = style.variants.length > 0 ? [...style.variants] : [...config.field1.values]
  const v2 = !config.field2
    ? ['']
    : style.sizes === null
      ? [...config.field2.values] // legacy: not set yet
      : style.sizes.length === 0
        ? [''] // this product has no second field
        : [...style.sizes]

  for (const u of stock) {
    if (u.style_id !== style.id || u.qty <= 0) continue
    if (!v1.includes(u.variant)) v1.push(u.variant)
    if (config.field2 && !v2.includes(u.size)) v2.push(u.size)
  }
  return { v1, v2 }
}

/** Fill in fields missing from older snapshots / backups (pre-005 styles). */
export function normalizeStyle(raw: Partial<Style> & Pick<Style, 'id' | 'name'>): Style {
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: raw.imageUrl ?? null,
    variants: Array.isArray(raw.variants) ? raw.variants.filter(isStr) : [],
    sizes: Array.isArray(raw.sizes) ? raw.sizes.filter(isStr) : null,
    created_at: raw.created_at ?? new Date().toISOString(),
  }
}

function isStr(x: unknown): x is string {
  return typeof x === 'string'
}

/** True when the grid really has a second dimension (not just the '' column). */
export function hasSecondAxis(axes: Axes): boolean {
  return !(axes.v2.length === 1 && axes.v2[0] === '')
}

/** Header label for a grid column — '' (no second field) renders as a dash. */
export function axisLabel(value: string): string {
  return value === '' ? '–' : value
}

// ---------------------------------------------------------------------------
// Ordering help for size-like values.
// ---------------------------------------------------------------------------

const LETTER_SIZE_RANK: Record<string, number> = {
  '4xs': 0,
  '3xs': 1, xxxs: 1,
  '2xs': 2, xxs: 2,
  xs: 3,
  s: 4,
  m: 5,
  l: 6,
  xl: 7,
  '2xl': 8, xxl: 8,
  '3xl': 9, xxxl: 9,
  '4xl': 10, xxxxl: 10,
  '5xl': 11,
  '6xl': 12,
}

/**
 * Sort rank for a value that looks like a size: letter sizes (4XS…6XL, any
 * case) first, then numeric sizes (36, 42.5, "42,5") in numeric order.
 * null = not a recognisable size.
 */
export function sizeRank(value: string): number | null {
  const k = value.trim().toLowerCase().replace(/\s+/g, '')
  if (k in LETTER_SIZE_RANK) return LETTER_SIZE_RANK[k]
  const num = Number(k.replace(',', '.'))
  if (k !== '' && Number.isFinite(num)) return 1000 + num
  return null
}

/**
 * Add a value to a list. When EVERY value (old and new) is a recognisable size,
 * the list is kept in size order, so adding "XS" to S/M/L/XL lands it first
 * instead of last. Any other list is treated as custom order → append.
 */
export function insertValue(values: string[], value: string): string[] {
  const next = [...values, value]
  const ranks = next.map(sizeRank)
  if (ranks.some((r) => r === null)) return next
  return next
    .map((val, i) => ({ val, rank: ranks[i] as number }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.val)
}
