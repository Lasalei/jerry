import type { DataSnapshot } from './types'
import { todayISO } from './format'

/** Trigger a browser download of a Blob. */
function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Full JSON backup of all data. */
export function exportJSON(data: DataSnapshot) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  download(`draktlager-backup-${todayISO()}.json`, blob)
}

function csvField(value: string | number): string {
  const s = String(value)
  if (/[;"\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * Sales CSV, one row per line item, semicolon-separated so Norwegian Excel
 * parses columns directly. UTF-8 BOM keeps æ/ø/å intact in Excel.
 */
export function exportSalesCSV(data: DataSnapshot) {
  const headers = [
    'Dato',
    'Type',
    'Kjøper',
    'Kanal',
    'Betaling',
    'Stil',
    'Variant',
    'Størrelse',
    'Antall',
    'Pris',
    'Sum',
    'Frakt',
    'Sporingskode',
    'Notat',
  ]

  const rows: string[] = [headers.map(csvField).join(';')]

  const sorted = [...data.transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )

  for (const tx of sorted) {
    for (const it of tx.items) {
      rows.push(
        [
          tx.date,
          tx.type === 'salg' ? 'Salg' : 'Gitt bort',
          tx.buyer,
          tx.channel,
          tx.payment ?? '',
          it.styleName,
          it.variant,
          it.size,
          it.qty,
          tx.type === 'salg' ? it.price : 0,
          tx.type === 'salg' ? it.price * it.qty : 0,
          tx.carrier ?? '',
          tx.trackingCode ?? '',
          tx.note,
        ]
          .map(csvField)
          .join(';'),
      )
    }
  }

  // ﻿ = BOM
  const blob = new Blob(['﻿' + rows.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  download(`draktlager-salg-${todayISO()}.csv`, blob)
}

/** Parse + minimally validate an imported JSON backup. Throws on bad shape. */
export function parseImport(text: string): DataSnapshot {
  const parsed = JSON.parse(text) as Partial<DataSnapshot>
  if (
    !parsed ||
    !Array.isArray(parsed.styles) ||
    !Array.isArray(parsed.stock) ||
    !Array.isArray(parsed.transactions)
  ) {
    throw new Error('Ugyldig fil: mangler styles/stock/transactions')
  }
  return {
    styles: parsed.styles,
    stock: parsed.stock,
    transactions: parsed.transactions,
  }
}
