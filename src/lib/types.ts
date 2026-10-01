// Domain model for Varelager (the inventory + sales PWA, formerly Draktlager).

// The two product axes are configurable per workspace (see AppConfig). They were
// once jersey-specific unions ("Hjemme – Fan" / "S".."3XL"); now they are plain
// strings whose allowed values come from the workspace config. field1 maps to the
// `variant` column, field2 (optional) to the `size` column. A single-field
// workspace leaves `size` as the empty string ''.
export type Variant = string
export type Size = string

/**
 * One configurable product axis: a display name + its DEFAULT values. The values
 * pre-fill a new product's grid; each product then keeps its own list (Style.variants
 * / Style.sizes) and can add or remove values freely.
 */
export interface ProductField {
  name: string
  values: string[]
}

/** Per-workspace configuration of what a "product" is and its 1–2 axes. */
export interface AppConfig {
  /** What one product is called, e.g. "Produkt", "Vare" or "Stil". */
  productLabel: string
  /** Always present; maps to the `variant` column. */
  field1: ProductField
  /** Optional second axis; maps to the `size` column. null = single-field. */
  field2: ProductField | null
}

export type Channel = 'Finn' | 'Direkte' | 'Annet'

export type Payment = 'Vipps' | 'Kontant' | 'Bank' | 'Annet'

/** Shipping carrier. null = no shipping (e.g. picked up in person). */
export type Carrier = 'Posten' | 'PostNord' | 'Helthjem' | 'Annet'

export type TxType = 'salg' | 'gitt_bort'

/** A product, e.g. "Nike svart t-skjorte" (historically a jersey style). */
export interface Style {
  id: string
  name: string
  /** Optional photo as a downscaled data URL (base64 JPEG). null = no photo. */
  imageUrl: string | null
  /**
   * This product's own field1 values (grid rows), in display order. Each product
   * picks its own — "Nike t-skjorte" can have Svart/Hvit while another has Grå.
   * Empty = not set yet (pre-005 data): falls back to the workspace defaults.
   */
  variants: string[]
  /**
   * This product's own field2 values (grid columns), in display order. Empty in a
   * single-field workspace, or = not set yet (falls back to workspace defaults).
   */
  sizes: string[]
  created_at: string
}

/** Everything needed to create or update a product (stock grid passed separately). */
export interface StyleInput {
  name: string
  imageUrl: string | null
  variants: string[]
  sizes: string[]
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
  /** Helthjem scheduled pickup date (yyyy-mm-dd); null for other carriers/none. */
  pickupDate: string | null
  /** Fulfillment flag: false = outstanding order, true = handled/sent. */
  sent: boolean
  note: string
  /** Auto-summed price * qty across items (0 for gitt_bort). */
  total: number
  items: TransactionItem[]
  created_at: string
}

/** A full snapshot of all data — the unit of export/import + initial load. */
export interface DataSnapshot {
  config: AppConfig
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
