// Supabase backend. Implements the same DraktlagerDB interface as the
// localStorage backend, so swapping is just which instance ./db exports.
//
// Atomicity: a sale (or giveaway) and its stock decrement go through the
// `create_transaction` RPC; deleting + restoring stock goes through
// `delete_transaction`; import goes through `import_data`. See supabase/schema.sql.
//
// Offline: every successful getAll() is cached to localStorage. If a read fails
// (offline), we return the cached snapshot so the app stays usable for viewing.
// Writes require connectivity and surface an error if offline.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AppConfig,
  DataSnapshot,
  GridCell,
  Size,
  Style,
  StyleInput,
  StockUnit,
  Transaction,
  TransactionItem,
  Variant,
} from './types'
import { DEFAULT_CONFIG } from './constants'
import { cellKey } from './axes'
import { computeTotal, type DraktlagerDB, type NewTransaction } from './dbTypes'
import { readLocalSnapshot, writeLocalSnapshot } from './localDb'

const TABLES = ['styles', 'stock', 'transactions', 'transaction_items', 'app_config'] as const

interface StyleRow {
  id: string
  name: string
  image_url: string | null
  /** Per-product grid axes. null = saved before migration 005 (fall back to defaults). */
  axes: { variants?: unknown; sizes?: unknown } | null
  created_at: string
}

function rowToStyle(s: StyleRow): Style {
  const strs = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
  return {
    id: s.id,
    name: s.name,
    imageUrl: s.image_url ?? null,
    variants: strs(s.axes?.variants),
    sizes: strs(s.axes?.sizes),
    created_at: s.created_at,
  }
}

function clampQty(qty: number): number {
  return Math.max(0, Math.round(qty) || 0)
}

interface ConfigRow {
  product_label: string
  fields: { field1: AppConfig['field1']; field2: AppConfig['field2'] }
}

interface ItemRow {
  transaction_id: string
  style_id: string | null
  style_name: string
  variant: string
  size: string
  qty: number
  price: number
}

interface TxRow {
  id: string
  date: string
  type: 'salg' | 'gitt_bort'
  buyer: string
  channel: string
  payment: string | null
  carrier: string | null
  tracking_code: string | null
  pickup_date: string | null
  sent: boolean | null
  note: string
  total: number
  created_at: string
}

export class SupabaseDB implements DraktlagerDB {
  private sb: SupabaseClient
  /**
   * Set once a write fails because styles.axes doesn't exist (migration 005 not
   * run yet). Product writes then omit the column so the app keeps working the
   * old way (workspace-wide values) instead of breaking until the migration runs.
   */
  private axesUnsupported = false

  constructor(sb: SupabaseClient) {
    this.sb = sb
  }

  /** The styles row payload, with axes unless the DB can't take them. */
  private stylePayload(input: StyleInput) {
    const base = { name: input.name.trim(), image_url: input.imageUrl }
    return this.axesUnsupported
      ? base
      : { ...base, axes: { variants: input.variants, sizes: input.sizes } }
  }

  async getAll(): Promise<DataSnapshot> {
    try {
      const [styles, stock, txs, items, cfg] = await Promise.all([
        this.sb.from('styles').select('*'),
        this.sb.from('stock').select('*'),
        this.sb.from('transactions').select('*'),
        this.sb.from('transaction_items').select('*'),
        this.sb.from('app_config').select('*').limit(1).maybeSingle(),
      ])
      for (const res of [styles, stock, txs, items]) {
        if (res.error) throw res.error
      }
      // app_config may not exist yet (before migration 004) — fall back to default.
      const config: AppConfig = cfg.data
        ? {
            productLabel: (cfg.data as ConfigRow).product_label,
            field1: (cfg.data as ConfigRow).fields.field1,
            field2: (cfg.data as ConfigRow).fields.field2,
          }
        : DEFAULT_CONFIG

      // Group items under their transaction.
      const itemsByTx = new Map<string, TransactionItem[]>()
      for (const row of (items.data ?? []) as ItemRow[]) {
        const list = itemsByTx.get(row.transaction_id) ?? []
        list.push({
          styleId: row.style_id ?? '',
          styleName: row.style_name,
          variant: row.variant as Variant,
          size: row.size as Size,
          qty: row.qty,
          price: row.price,
        })
        itemsByTx.set(row.transaction_id, list)
      }

      const snapshot: DataSnapshot = {
        config,
        styles: ((styles.data ?? []) as StyleRow[]).map(rowToStyle),
        stock: (stock.data ?? []) as StockUnit[],
        transactions: ((txs.data ?? []) as TxRow[]).map((t) => ({
          id: t.id,
          date: t.date,
          type: t.type,
          buyer: t.buyer,
          channel: t.channel as Transaction['channel'],
          payment: t.payment as Transaction['payment'],
          carrier: t.carrier as Transaction['carrier'],
          trackingCode: t.tracking_code ?? '',
          pickupDate: t.pickup_date,
          sent: t.sent ?? false,
          note: t.note,
          total: t.total,
          items: itemsByTx.get(t.id) ?? [],
          created_at: t.created_at,
        })),
      }

      writeLocalSnapshot(snapshot) // cache for offline viewing
      return snapshot
    } catch (err) {
      // Offline / network error: serve the last cached snapshot read-only.
      const cached = readLocalSnapshot()
      if (cached.styles.length || cached.transactions.length || cached.stock.length) {
        return cached
      }
      throw err
    }
  }

  async addStyle(input: StyleInput, grid: GridCell[]): Promise<Style> {
    let res = await this.sb.from('styles').insert(this.stylePayload(input)).select().single()
    if (res.error && isMissingAxesColumn(res.error)) {
      this.axesUnsupported = true
      res = await this.sb.from('styles').insert(this.stylePayload(input)).select().single()
    }
    const { data: style, error } = res
    if (error) throw error

    const rows = dedupeCells(grid).map((c) => ({
      style_id: (style as StyleRow).id,
      variant: c.variant,
      size: c.size,
      qty: clampQty(c.qty),
    }))
    if (rows.length > 0) {
      const { error: stockErr } = await this.sb.from('stock').insert(rows)
      if (stockErr) throw stockErr
    }

    return rowToStyle(style as StyleRow)
  }

  async updateStyle(id: string, input: StyleInput, grid: GridCell[]): Promise<void> {
    let res = await this.sb.from('styles').update(this.stylePayload(input)).eq('id', id)
    if (res.error && isMissingAxesColumn(res.error)) {
      this.axesUnsupported = true
      res = await this.sb.from('styles').update(this.stylePayload(input)).eq('id', id)
    }
    if (res.error) throw res.error

    const cells = dedupeCells(grid)
    const rows = cells.map((c) => ({
      style_id: id,
      variant: c.variant,
      size: c.size,
      qty: clampQty(c.qty),
    }))
    // Unique (style_id, variant, size) lets us upsert the whole grid in one call.
    if (rows.length > 0) {
      const { error } = await this.sb
        .from('stock')
        .upsert(rows, { onConflict: 'style_id,variant,size' })
      if (error) throw error
    }

    // Drop SKUs the product no longer has (a removed variant/size). Deleting by id
    // avoids building PostgREST filter strings out of user-typed values.
    const { data: existing, error: readErr } = await this.sb
      .from('stock')
      .select('id, variant, size')
      .eq('style_id', id)
    if (readErr) throw readErr
    const keep = new Set(cells.map((c) => cellKey(c.variant, c.size)))
    const stale = ((existing ?? []) as Array<{ id: string; variant: string; size: string }>)
      .filter((r) => !keep.has(cellKey(r.variant, r.size)))
      .map((r) => r.id)
    if (stale.length > 0) {
      const { error: delErr } = await this.sb.from('stock').delete().in('id', stale)
      if (delErr) throw delErr
    }
  }

  async deleteStyle(id: string): Promise<void> {
    // Stock cascades; transaction_items.style_id is set null (history kept).
    const { error } = await this.sb.from('styles').delete().eq('id', id)
    if (error) throw error
  }

  async addTransaction(tx: NewTransaction): Promise<Transaction> {
    const total = computeTotal(tx)
    const payment = tx.type === 'gitt_bort' ? null : tx.payment
    const items: TransactionItem[] = tx.items.map((it) => ({
      ...it,
      price: tx.type === 'gitt_bort' ? 0 : it.price,
    }))

    const trackingCode = tx.trackingCode.trim()
    const { data: newId, error } = await this.sb.rpc('create_transaction', {
      p_date: tx.date,
      p_type: tx.type,
      p_buyer: tx.buyer.trim(),
      p_channel: tx.channel,
      p_payment: payment,
      p_carrier: tx.carrier,
      p_tracking_code: trackingCode,
      p_pickup_date: tx.pickupDate,
      p_note: tx.note.trim(),
      p_total: total,
      p_items: items,
    })
    if (error) throw error

    return {
      id: newId as string,
      date: tx.date,
      type: tx.type,
      buyer: tx.buyer.trim(),
      channel: tx.channel,
      payment,
      carrier: tx.carrier,
      trackingCode,
      pickupDate: tx.pickupDate,
      sent: false,
      note: tx.note.trim(),
      total,
      items,
      created_at: new Date().toISOString(),
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.sb.rpc('delete_transaction', { p_tx_id: id })
    if (error) throw error
  }

  async updateOrder(
    id: string,
    patch: { pickupDate?: string | null; sent?: boolean },
  ): Promise<void> {
    // No stock involved — a plain column update is enough (no RPC needed).
    const row: { pickup_date?: string | null; sent?: boolean } = {}
    if (patch.pickupDate !== undefined) row.pickup_date = patch.pickupDate
    if (patch.sent !== undefined) row.sent = patch.sent
    const { error } = await this.sb.from('transactions').update(row).eq('id', id)
    if (error) throw error
  }

  async saveConfig(config: AppConfig): Promise<void> {
    // Single-row table keyed by a fixed id ('singleton') — upsert it.
    const { error } = await this.sb.from('app_config').upsert(
      {
        id: 'singleton',
        product_label: config.productLabel,
        fields: { field1: config.field1, field2: config.field2 },
      },
      { onConflict: 'id' },
    )
    if (error) throw error
  }

  async importData(snapshot: DataSnapshot): Promise<void> {
    const { error } = await this.sb.rpc('import_data', {
      payload: {
        styles: snapshot.styles ?? [],
        stock: snapshot.stock ?? [],
        transactions: snapshot.transactions ?? [],
      },
    })
    if (error) throw error
    if (snapshot.config) await this.saveConfig(snapshot.config)
    writeLocalSnapshot(snapshot)
  }

  subscribe(listener: () => void): () => void {
    const channel = this.sb.channel('draktlager-changes')
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        listener()
      })
    }
    channel.subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }
}

/** Collapse duplicate cells (same variant+size) to the last one. */
function dedupeCells(grid: GridCell[]): GridCell[] {
  const m = new Map<string, GridCell>()
  for (const c of grid) m.set(cellKey(c.variant, c.size), c)
  return [...m.values()]
}

/**
 * PostgREST rejects an unknown column with PGRST204 ("Could not find the 'axes'
 * column of 'styles' in the schema cache") — i.e. migration 005 hasn't run.
 */
function isMissingAxesColumn(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST204' && /axes/i.test(error.message ?? '')
}
