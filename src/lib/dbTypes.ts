// The persistence contract. Both the localStorage and Supabase backends
// implement `DraktlagerDB`; the rest of the app only ever sees this interface
// (via the `db` singleton exported from ./db).

import type { DataSnapshot, GridCell, Style, Transaction, TransactionItem } from './types'

/** Input to create a transaction. id/created_at/total are computed by the db. */
export interface NewTransaction {
  date: string
  type: Transaction['type']
  buyer: string
  channel: Transaction['channel']
  payment: Transaction['payment']
  carrier: Transaction['carrier']
  trackingCode: string
  note: string
  items: TransactionItem[]
}

export interface DraktlagerDB {
  /** Load the full dataset (styles, stock, transactions). */
  getAll(): Promise<DataSnapshot>

  /** Create a style and its stock grid (one SKU per variant × size). */
  addStyle(name: string, grid: GridCell[]): Promise<Style>

  /** Rename a style and/or update its stock grid quantities. */
  updateStyle(id: string, name: string, grid: GridCell[]): Promise<void>

  /** Delete a style and its stock. Transaction history is preserved (snapshot). */
  deleteStyle(id: string): Promise<void>

  /** Save a transaction and decrement the matching stock SKUs. */
  addTransaction(tx: NewTransaction): Promise<Transaction>

  /** Delete a transaction and restore the stock it consumed. */
  deleteTransaction(id: string): Promise<void>

  /** Replace the entire dataset (used by JSON import). */
  importData(snapshot: DataSnapshot): Promise<void>

  /** Subscribe to external changes (other tabs locally; realtime via Supabase). */
  subscribe(listener: () => void): () => void
}

export function computeTotal(tx: NewTransaction): number {
  if (tx.type === 'gitt_bort') return 0
  return tx.items.reduce((sum, it) => sum + it.price * it.qty, 0)
}
