import type { AppConfig, Channel, Payment, Carrier } from './types'

export const CHANNELS: Channel[] = ['Finn', 'Direkte', 'Annet']

export const PAYMENTS: Payment[] = ['Vipps', 'Kontant', 'Bank', 'Annet']

export const CARRIERS: Carrier[] = ['Posten', 'PostNord', 'Helthjem', 'Annet']

/**
 * Default workspace config — reproduces the original jersey setup exactly, so a
 * workspace with no saved config behaves identically to before. A new workspace
 * (e.g. a friend reselling clothes) edits this via the Innstillinger screen. The
 * values here are only DEFAULTS for new products; each product keeps its own list.
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
