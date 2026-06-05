import type { DataSnapshot } from './types'

export interface Stats {
  totalSold: number
  totalRevenue: number
  topVariant: string
  topSize: string
  giftCount: number
}

function topKey(counts: Record<string, number>): string {
  let best = ''
  let bestN = -1
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best || '–'
}

export function computeStats(data: DataSnapshot): Stats {
  let totalSold = 0
  let totalRevenue = 0
  let giftCount = 0
  const variantCounts: Record<string, number> = {}
  const sizeCounts: Record<string, number> = {}

  for (const tx of data.transactions) {
    if (tx.type === 'gitt_bort') giftCount += 1
    for (const it of tx.items) {
      if (tx.type === 'salg') {
        totalSold += it.qty
        totalRevenue += it.price * it.qty
      }
      variantCounts[it.variant] = (variantCounts[it.variant] ?? 0) + it.qty
      // Skip the empty second axis used by single-field workspaces.
      if (it.size) sizeCounts[it.size] = (sizeCounts[it.size] ?? 0) + it.qty
    }
  }

  return {
    totalSold,
    totalRevenue,
    topVariant: topKey(variantCounts),
    topSize: topKey(sizeCounts),
    giftCount,
  }
}
