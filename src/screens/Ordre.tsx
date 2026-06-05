import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { Card, ScreenHeader, Stat, controlClass } from '../components/ui'
import { formatDate } from '../lib/format'
import type { Transaction } from '../lib/types'

const NO_DATE = 'Uten dato'

/** An order = a transaction with a shipping carrier that hasn't been handled. */
function isOrder(tx: Transaction): boolean {
  return tx.carrier !== null && !tx.sent
}

function itemSummary(tx: Transaction): string {
  const count = tx.items.reduce((sum, it) => sum + it.qty, 0)
  const first = tx.items[0]?.styleName ?? ''
  const more = tx.items.length > 1 ? ` +${tx.items.length - 1}` : ''
  return `${count} stk · ${first}${more}`
}

export function Ordre() {
  const { data, updateOrder } = useStore()
  const toast = useToast()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [showSent, setShowSent] = useState(false)

  const orders = useMemo(
    () => data.transactions.filter(isOrder),
    [data.transactions],
  )

  // Helthjem pickups, grouped by pickup date (soonest first; "Uten dato" last).
  const helthjemGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const tx of orders) {
      if (tx.carrier !== 'Helthjem') continue
      const key = tx.pickupDate ?? NO_DATE
      const list = groups.get(key) ?? []
      list.push(tx)
      groups.set(key, list)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === NO_DATE) return 1
      if (b === NO_DATE) return -1
      return a < b ? -1 : a > b ? 1 : 0
    })
  }, [orders])

  // Manual deliveries: everything else with a carrier (Posten/PostNord/Annet).
  const manual = useMemo(
    () =>
      orders
        .filter((tx) => tx.carrier !== 'Helthjem')
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [orders],
  )

  const sentOrders = useMemo(
    () =>
      data.transactions
        .filter((tx) => tx.carrier !== null && tx.sent)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.transactions],
  )

  const helthjemCount = orders.filter((o) => o.carrier === 'Helthjem').length

  async function markSent(tx: Transaction) {
    await updateOrder(tx.id, { sent: true })
    toast(tx.carrier === 'Helthjem' ? 'Merket som hentet' : 'Merket som sendt')
  }

  async function unsend(tx: Transaction) {
    await updateOrder(tx.id, { sent: false })
    toast('Lagt tilbake i køen')
  }

  async function changePickup(tx: Transaction, value: string) {
    await updateOrder(tx.id, { pickupDate: value || null })
  }

  function OrderRow({
    tx,
    action,
    showPickupEditor,
  }: {
    tx: Transaction
    action: 'hentet' | 'sendt'
    showPickupEditor?: boolean
  }) {
    const isOpen = expanded === tx.id
    return (
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(isOpen ? null : tx.id)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left"
        >
          <div className="min-w-0">
            <span className="font-semibold text-ink">
              {tx.buyer || 'Ukjent kjøper'}
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {itemSummary(tx)}
            </span>
          </div>
          <span className="shrink-0 rounded-md bg-canvas px-2 py-1 text-[11px] font-semibold uppercase text-muted">
            {tx.carrier}
          </span>
        </button>

        {isOpen && (
          <div className="border-t border-line p-4 anim-slide-up">
            <ul className="space-y-1.5">
              {tx.items.map((it, i) => (
                <li key={i} className="text-sm text-muted">
                  <span className="font-semibold text-ink">{it.styleName}</span>
                  {' · '}
                  {[it.variant, it.size].filter(Boolean).join(' · ')} · {it.qty} stk
                </li>
              ))}
            </ul>

            {tx.trackingCode && (
              <p className="mt-2 text-sm text-muted">
                Sporing: <span className="tnum text-ink">{tx.trackingCode}</span>
              </p>
            )}

            {showPickupEditor && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Hentedato
                </span>
                <input
                  type="date"
                  value={tx.pickupDate ?? ''}
                  onChange={(e) => changePickup(tx, e.target.value)}
                  className={controlClass}
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => markSent(tx)}
              className="mt-4 w-full rounded-xl bg-kit py-3 text-center font-display text-base font-semibold uppercase tracking-wide text-white active:bg-kit-700"
            >
              {action === 'hentet' ? 'Hentet' : 'Sendt'}
            </button>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-4">
      <ScreenHeader title="Ordre" />

      <div className="space-y-3 px-4">
        <Card className="flex items-center gap-4 p-4">
          <Stat value={orders.length} label="Utestående" accent />
          <Stat value={helthjemCount} label="Helthjem-henting" />
        </Card>

        {orders.length === 0 && !showSent && (
          <Card className="p-6 text-center text-sm text-muted">
            Ingen utestående ordre.
          </Card>
        )}

        {/* Section 1 — Helthjem pickups grouped by date */}
        {helthjemGroups.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Helthjem-henting
            </h2>
            {helthjemGroups.map(([key, txs]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="font-display text-lg font-semibold text-ink">
                    {key === NO_DATE ? 'Uten hentedato' : `Hentes ${formatDate(key)}`}
                  </span>
                  <span className="text-sm tnum text-muted">
                    {txs.length} {txs.length === 1 ? 'pakke' : 'pakker'}
                  </span>
                </div>
                {txs.map((tx) => (
                  <OrderRow key={tx.id} tx={tx} action="hentet" showPickupEditor />
                ))}
              </div>
            ))}
          </section>
        )}

        {/* Section 2 — Manual deliveries (Posten / PostNord / Annet) */}
        {manual.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Manuell levering
            </h2>
            {manual.map((tx) => (
              <OrderRow key={tx.id} tx={tx} action="sendt" />
            ))}
          </section>
        )}

        {/* Sent / handled orders (collapsed by default) */}
        {sentOrders.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSent((v) => !v)}
              className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-muted active:bg-canvas"
            >
              {showSent ? 'Skjul sendte' : `Vis sendte (${sentOrders.length})`}
            </button>

            {showSent && (
              <div className="mt-2 space-y-2">
                {sentOrders.map((tx) => (
                  <Card key={tx.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">
                        {tx.buyer || 'Ukjent kjøper'}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {tx.carrier}
                        {tx.carrier === 'Helthjem' && tx.pickupDate
                          ? ` · ${formatDate(tx.pickupDate)}`
                          : ''}
                        {' · '}
                        {itemSummary(tx)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => unsend(tx)}
                      className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-kit active:bg-canvas"
                    >
                      Angre
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
