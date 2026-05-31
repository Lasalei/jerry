// localStorage backend. Used as the primary store when no Supabase env vars are
// set, and as a read-only offline cache fallback when Supabase is configured.

import type { DataSnapshot, GridCell, Style, StockUnit, Transaction } from './types'
import { VARIANTS, SIZES } from './constants'
import { computeTotal, type DraktlagerDB, type NewTransaction } from './dbTypes'

const STORAGE_KEY = 'draktlager_v1'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function nowISO(): string {
  return new Date().toISOString()
}

function emptySnapshot(): DataSnapshot {
  return { styles: [], stock: [], transactions: [] }
}

/** Build the full 24-cell grid for a style, defaulting missing cells to 0. */
function fullGridFor(styleId: string, cells: GridCell[]): StockUnit[] {
  const lookup = new Map(cells.map((c) => [`${c.variant}__${c.size}`, c.qty]))
  const units: StockUnit[] = []
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      units.push({
        id: uid(),
        style_id: styleId,
        variant,
        size,
        qty: Math.max(0, Math.round(lookup.get(`${variant}__${size}`) ?? 0)),
      })
    }
  }
  return units
}

/** Low-level read of the cached snapshot — also used by the Supabase fallback. */
export function readLocalSnapshot(): DataSnapshot {
  if (typeof localStorage === 'undefined') return emptySnapshot()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptySnapshot()
  try {
    const parsed = JSON.parse(raw) as Partial<DataSnapshot>
    return {
      styles: parsed.styles ?? [],
      stock: parsed.stock ?? [],
      transactions: parsed.transactions ?? [],
    }
  } catch {
    return emptySnapshot()
  }
}

/** Low-level write of the cached snapshot — also used by the Supabase fallback. */
export function writeLocalSnapshot(data: DataSnapshot): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}

export class LocalStorageDB implements DraktlagerDB {
  private listeners = new Set<() => void>()

  constructor() {
    // Cross-tab sync: another tab writing the key fires `storage`.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) this.emit()
      })
    }
  }

  private read(): DataSnapshot {
    return readLocalSnapshot()
  }

  private write(data: DataSnapshot): void {
    writeLocalSnapshot(data)
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }

  async getAll(): Promise<DataSnapshot> {
    return this.read()
  }

  async addStyle(name: string, grid: GridCell[], imageUrl: string | null): Promise<Style> {
    const data = this.read()
    const style: Style = { id: uid(), name: name.trim(), imageUrl, created_at: nowISO() }
    data.styles.push(style)
    data.stock.push(...fullGridFor(style.id, grid))
    this.write(data)
    return style
  }

  async updateStyle(
    id: string,
    name: string,
    grid: GridCell[],
    imageUrl: string | null,
  ): Promise<void> {
    const data = this.read()
    const style = data.styles.find((s) => s.id === id)
    if (!style) throw new Error('Fant ikke stilen')
    style.name = name.trim()
    style.imageUrl = imageUrl

    const desired = new Map(grid.map((c) => [`${c.variant}__${c.size}`, c.qty]))
    for (const unit of data.stock) {
      if (unit.style_id !== id) continue
      const key = `${unit.variant}__${unit.size}`
      if (desired.has(key)) {
        unit.qty = Math.max(0, Math.round(desired.get(key)!))
        desired.delete(key)
      }
    }
    for (const [key, qty] of desired) {
      const [variant, size] = key.split('__') as [StockUnit['variant'], StockUnit['size']]
      data.stock.push({ id: uid(), style_id: id, variant, size, qty: Math.max(0, Math.round(qty)) })
    }
    this.write(data)
  }

  async deleteStyle(id: string): Promise<void> {
    const data = this.read()
    data.styles = data.styles.filter((s) => s.id !== id)
    data.stock = data.stock.filter((u) => u.style_id !== id)
    this.write(data)
  }

  async addTransaction(tx: NewTransaction): Promise<Transaction> {
    const data = this.read()

    // Decrement each matching SKU. Stock can go to 0 but not negative.
    for (const item of tx.items) {
      const unit = data.stock.find(
        (u) => u.style_id === item.styleId && u.variant === item.variant && u.size === item.size,
      )
      if (unit) {
        unit.qty = Math.max(0, unit.qty - item.qty)
      }
    }

    const record: Transaction = {
      id: uid(),
      date: tx.date,
      type: tx.type,
      buyer: tx.buyer.trim(),
      channel: tx.channel,
      payment: tx.type === 'gitt_bort' ? null : tx.payment,
      carrier: tx.carrier,
      trackingCode: tx.trackingCode.trim(),
      pickupDate: tx.pickupDate,
      sent: false,
      note: tx.note.trim(),
      total: computeTotal(tx),
      items: tx.items.map((it) => ({ ...it })),
      created_at: nowISO(),
    }
    data.transactions.push(record)
    this.write(data)
    return record
  }

  async deleteTransaction(id: string): Promise<void> {
    const data = this.read()
    const tx = data.transactions.find((t) => t.id === id)
    if (!tx) return

    // Restore stock for each item back onto the matching SKU (recreate if gone).
    for (const item of tx.items) {
      const unit = data.stock.find(
        (u) => u.style_id === item.styleId && u.variant === item.variant && u.size === item.size,
      )
      if (unit) {
        unit.qty += item.qty
      } else if (data.styles.some((s) => s.id === item.styleId)) {
        data.stock.push({
          id: uid(),
          style_id: item.styleId,
          variant: item.variant,
          size: item.size,
          qty: item.qty,
        })
      }
      // If the style itself was deleted, there is nowhere to restore to — skip.
    }

    data.transactions = data.transactions.filter((t) => t.id !== id)
    this.write(data)
  }

  async updateOrder(
    id: string,
    patch: { pickupDate?: string | null; sent?: boolean },
  ): Promise<void> {
    const data = this.read()
    const tx = data.transactions.find((t) => t.id === id)
    if (!tx) return
    if (patch.pickupDate !== undefined) tx.pickupDate = patch.pickupDate
    if (patch.sent !== undefined) tx.sent = patch.sent
    this.write(data)
  }

  async importData(snapshot: DataSnapshot): Promise<void> {
    this.write({
      styles: snapshot.styles ?? [],
      stock: snapshot.stock ?? [],
      transactions: snapshot.transactions ?? [],
    })
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
