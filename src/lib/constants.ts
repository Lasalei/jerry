import type { Variant, Size, Channel, Payment } from './types'

export const VARIANTS: Variant[] = [
  'Hjemme – Fan',
  'Hjemme – Player',
  'Borte – Fan',
  'Borte – Player',
]

export const SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL', '3XL']

export const CHANNELS: Channel[] = ['Finn', 'Direkte', 'Annet']

export const PAYMENTS: Payment[] = ['Vipps', 'Kontant', 'Bank', 'Annet']

/** Shorter variant labels for tight UI spots (e.g. grid headers). */
export const VARIANT_SHORT: Record<Variant, string> = {
  'Hjemme – Fan': 'Hj · Fan',
  'Hjemme – Player': 'Hj · Player',
  'Borte – Fan': 'Bo · Fan',
  'Borte – Player': 'Bo · Player',
}
