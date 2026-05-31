// Domain model for Draktlager.

export type Variant =
  | 'Hjemme – Fan'
  | 'Hjemme – Player'
  | 'Borte – Fan'
  | 'Borte – Player'

export type Size = 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL'

export type Channel = 'Finn' | 'Direkte' | 'Annet'

export type Payment = 'Vipps' | 'Kontant' | 'Bank' | 'Annet'

/** Shipping carrier. null = no shipping (e.g. picked up in person). */
export type Carrier = 'Posten' | 'PostNord' | 'Helthjem' | 'Annet'

export type TxType = 'salg' | 'gitt_bort'

/** A jersey style = one team/design, e.g. "Liverpool 24/25". */
export interface Style {
  id: string
  name: string
  created_at: string
}

/** One SKU = style + variant + size, holding an integer quantity. */
export interface StockUnit {
  id: string
  style_id: string
  variant: Variant
  size: Size
  qty: number
}

export interface TransactionItem {
  styleId: string
  /** Snapshot so history survives if the style is later deleted. */
  styleName: string
  variant: Variant
  size: Size
  qty: number
  /** Price per unit, in kr. 0 for gitt_bort. */
  price: number
}

export interface Transaction {
  id: string
  /** ISO date string (yyyy-mm-dd). */
  date: string
  type: TxType
  buyer: string
  channel: Channel
  /** Only meaningful for salg; null for gitt_bort. */
  payment: Payment | null
  /** Shipping carrier, or null if not shipped (e.g. handed over in person). */
  carrier: Carrier | null
  /** Tracking / shipment code — free text. Empty if none. */
  trackingCode: string
  note: string
  /** Auto-summed price * qty across items (0 for gitt_bort). */
  total: number
  items: TransactionItem[]
  created_at: string
}

/** A full snapshot of all data — the unit of export/import + initial load. */
export interface DataSnapshot {
  styles: Style[]
  stock: StockUnit[]
  transactions: Transaction[]
}

/** One cell of the variant × size grid used when creating/editing a style. */
export interface GridCell {
  variant: Variant
  size: Size
  qty: number
}

/** Draft of a transaction item before it is persisted. */
export interface DraftItem {
  styleId: string
  variant: Variant | ''
  size: Size | ''
  qty: number
  price: number
}
