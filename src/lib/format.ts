// Norwegian (nb-NO) formatting helpers.

const nf = new Intl.NumberFormat('nb-NO')

/** 700 -> "700 kr" using nb-NO grouping. */
export function formatKr(amount: number): string {
  return `${nf.format(Math.round(amount))} kr`
}

/** 1234 -> "1 234" (nb-NO grouping, no currency). */
export function formatNum(n: number): string {
  return nf.format(n)
}

/** Today's date as yyyy-mm-dd in local time (for <input type="date">). */
export function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

const dateFmt = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "2026-05-30" -> "30. mai 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return dateFmt.format(d)
}

/** "2026-05" month key from an ISO date. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

const monthFmt = new Intl.DateTimeFormat('nb-NO', {
  month: 'long',
  year: 'numeric',
})

/** "2026-05" -> "mai 2026". */
export function formatMonth(key: string): string {
  const d = new Date(key + '-01T00:00:00')
  if (Number.isNaN(d.getTime())) return key
  return monthFmt.format(d)
}
