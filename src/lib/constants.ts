import type { AppConfig, Channel, Payment, Carrier } from './types'

export const CHANNELS: Channel[] = ['Finn', 'Direkte', 'Annet']

export const PAYMENTS: Payment[] = ['Vipps', 'Kontant', 'Bank', 'Annet']

export const CARRIERS: Carrier[] = ['Posten', 'PostNord', 'Helthjem', 'Annet']

/**
 * Default workspace config — reproduces the original jersey setup exactly, so a
 * workspace with no saved config behaves identically to before. A new workspace
 * (e.g. a friend reselling electronics) edits this via the Innstillinger screen.
 */
export const DEFAULT_CONFIG: AppConfig = {
  productLabel: 'Stil',
  field1: {
    name: 'Variant',
    values: ['Hjemme – Fan', 'Hjemme – Player', 'Borte – Fan', 'Borte – Player'],
  },
  field2: {
    name: 'Størrelse',
    values: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
}

/**
 * The field2 values for grid-building. A single-field workspace uses one synthetic
 * column keyed by the empty string '' so the (style_id, variant, size) SKU shape
 * is preserved.
 */
export function field2Values(config: AppConfig): string[] {
  return config.field2 ? config.field2.values : ['']
}
