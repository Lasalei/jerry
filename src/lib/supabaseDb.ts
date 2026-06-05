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
  StockUnit,
  Transaction,
  TransactionItem,
  Variant,
} from './types'
import { DEFAULT_CONFIG, field2Values } from './constants'
import { computeTotal, type DraktlagerDB, type NewTransaction } from './dbTypes'
import { readLocalSnapshot, writeLocalSnapshot } from './localDb'

const TABLES = ['styles', 'stock', 'transactions', 'transaction_items', 'app_config'] as const

interface StyleRow {
  id: string
  name: string
  image_url: string | null
  created_at: string
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

  constructor(sb: SupabaseClient) {
    this.sb = sb
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
        styles: ((styles.data ?? []) as StyleRow[]).map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.image_url ?? null,
          created_at: s.created_at,
        })),
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

  async addStyle(name: string, grid: GridCell[], imageUrl: string | null): Promise<Style> {
    const { data: style, error } = await this.sb
      .from('styles')
      .insert({ name: name.trim(), image_url: imageUrl })
      .select()
      .single()
    if (error) throw error

    const config = await this.fetchConfig()
    const lookup = new Map(grid.map((c) => [`${c.variant}__${c.size}`, c.qty]))
    const rows: Array<Omit<StockUnit, 'id'>> = []
    for (const variant of config.field1.values) {
      for (const size of field2Values(config)) {
        rows.push({
          style_id: style.id,
          variant,
          size,
          qty: Math.max(0, Math.round(lookup.get(`${variant}__${size}`) ?? 0)),
        })
      }
    }
    const { error: stockErr } = await this.sb.from('stock').insert(rows)
    if (stockErr) throw stockErr

    const s = style as StyleRow
    return { id: s.id, name: s.name, imageUrl: s.image_url ?? null, created_at: s.created_at }
  }

  async updateStyle(
    id: string,
    name: string,
    grid: GridCell[],
    imageUrl: string | null,
  ): Promise<void> {
    const { error: nameErr } = await this.sb
      .from('styles')
      .update({ name: name.trim(), image_url: imageUrl })
      .eq('id', id)
    if (nameErr) throw nameErr

    const rows = grid.map((c) => ({
      style_id: id,
      variant: c.variant,
      size: c.size,
      qty: Math.max(0, Math.round(c.qty)),
    }))
    // Unique (style_id, variant, size) lets us upsert the whole grid in one call.
    const { error } = await this.sb
      .from('stock')
      .upsert(rows, { onConflict: 'style_id,variant,size' })
    if (error) throw error
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

  /** Read the config row, defaulting if the table/row is absent. */
  private async fetchConfig(): Promise<AppConfig> {
    const { data } = await this.sb.from('app_config').select('*').limit(1).maybeSingle()
    if (!data) return DEFAULT_CONFIG
    const row = data as ConfigRow
    return { productLabel: row.product_label, field1: row.fields.field1, field2: row.fields.field2 }
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
