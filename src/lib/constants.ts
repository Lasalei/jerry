import type { AppConfig, Channel, Payment, Carrier } from './types'

/**
 * The app's display name — lock screen, Mer footer, export file names, browser
 * title and the home-screen icon label (vite.config.ts reads it too). Change it
 * here and everything follows.
 */
export const APP_NAME = 'Varelager'

/** Short description used in the PWA manifest. */
export const APP_DESCRIPTION = 'Hold oversikt over varelager og salg'

export const CHANNELS: Channel[] = ['Finn', 'Direkte', 'Annet']

export const PAYMENTS: Payment[] = ['Vipps', 'Kontant', 'Bank', 'Annet']

export const CARRIERS: Carrier[] = ['Posten', 'PostNord', 'Helthjem', 'Annet']

/**
 * Default workspace config for a brand-new workspace (or when the app_config row
 * can't be read): a generic Produkt × Variant × Størrelse setup. Edited via the
 * Innstillinger screen. The values here are only DEFAULTS pre-filled on a new
 * product; each product keeps its own list.
 */
export const DEFAULT_CONFIG: AppConfig = {
  productLabel: 'Produkt',
  field1: {
    name: 'Variant',
    values: ['Standard'],
  },
  field2: {
    name: 'Størrelse',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
}
