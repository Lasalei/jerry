// The persistence contract. Both the localStorage and Supabase backends
// implement `DraktlagerDB`; the rest of the app only ever sees this interface
// (via the `db` singleton exported from ./db).

import type {
  AppConfig,
  DataSnapshot,
  GridCell,
  Style,
  StyleInput,
  Transaction,
  TransactionItem,
} from './types'

/** Input to create a transaction. id/created_at/total are computed by the db. */
export interface NewTransaction {
  date: string
  type: Transaction['type']
  buyer: string
  channel: Transaction['channel']
  payment: Transaction['payment']
  carrier: Transaction['carrier']
  trackingCode: string
  /** Helthjem pickup date (yyyy-mm-dd) or null. A new sale always starts unsent. */
  pickupDate: string | null
  note: string
  items: TransactionItem[]
}

export interface DraktlagerDB {
  /** Load the full dataset (styles, stock, transactions). */
  getAll(): Promise<DataSnapshot>

  /**
   * Create a product with its own axes and stock grid. `grid` is the full set of
   * cells (variants × sizes, zeros included) — the db writes exactly these SKUs.
   */
  addStyle(input: StyleInput, grid: GridCell[]): Promise<Style>

  /**
   * Update a product's name / photo / axes and replace its stock grid: cells in
   * `grid` are upserted, SKUs no longer in the grid are deleted.
   */
  updateStyle(id: string, input: StyleInput, grid: GridCell[]): Promise<void>

  /** Delete a style and its stock. Transaction history is preserved (snapshot). */
  deleteStyle(id: string): Promise<void>

  /** Save a transaction and decrement the matching stock SKUs. */
  addTransaction(tx: NewTransaction): Promise<Transaction>

  /** Delete a transaction and restore the stock it consumed. */
  deleteTransaction(id: string): Promise<void>

  /** Update fulfillment fields on an order (pickup date / sent flag). No stock change. */
  updateOrder(
    id: string,
    patch: { pickupDate?: string | null; sent?: boolean },
  ): Promise<void>

  /** Save the workspace product config (label + 1–2 fields). */
  saveConfig(config: AppConfig): Promise<void>

  /** Replace the entire dataset (used by JSON import). */
  importData(snapshot: DataSnapshot): Promise<void>

  /** Subscribe to external changes (other tabs locally; realtime via Supabase). */
  subscribe(listener: () => void): () => void
}

export function computeTotal(tx: NewTransaction): number {
  if (tx.type === 'gitt_bort') return 0
  return tx.items.reduce((sum, it) => sum + it.price * it.qty, 0)
}
