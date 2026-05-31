import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { Card, NativeSelect, ScreenHeader, Stat } from '../components/ui'
import { formatDate, formatKr, formatMonth, monthKey } from '../lib/format'
import type { Transaction } from '../lib/types'

export function Logg() {
  const { data, deleteTransaction } = useStore()
  const confirm = useConfirm()
  const toast = useToast()

  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Newest first.
  const sorted = useMemo(
    () =>
      [...data.transactions].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return a.created_at < b.created_at ? 1 : -1
      }),
    [data.transactions],
  )

  // Month options present in the data.
  const months = useMemo(() => {
    const set = new Set(data.transactions.map((t) => monthKey(t.date)))
    return [...set].sort().reverse()
  }, [data.transactions])

  const visible = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((t) => monthKey(t.date) === filter)),
    [sorted, filter],
  )

  const sales = visible.filter((t) => t.type === 'salg')
  const revenue = sales.reduce((sum, t) => sum + t.total, 0)

  async function handleDelete(tx: Transaction) {
    const ok = await confirm({
      title: tx.type === 'salg' ? 'Slette salg?' : 'Slette oppføring?',
      message: 'Lagerbeholdningen legges tilbake.',
      confirmLabel: 'Slett',
      danger: true,
    })
    if (ok) {
      await deleteTransaction(tx.id)
      toast('Slettet · lager gjenopprettet')
    }
  }

  return (
    <div className="mx-auto max-w-lg pb-4">
      <ScreenHeader title="Logg" />

      <div className="space-y-3 px-4">
        <Card className="flex items-center gap-4 p-4">
          <Stat value={formatKr(revenue)} label="Omsetning" accent />
          <Stat value={sales.length} label="Salg" />
        </Card>

        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Hele tiden</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </NativeSelect>

        {visible.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            Ingen oppføringer ennå.
          </Card>
        )}

        {visible.map((tx) => {
          const isOpen = expanded === tx.id
          const isGift = tx.type === 'gitt_bort'
          const itemCount = tx.items.reduce((sum, it) => sum + it.qty, 0)
          return (
            <Card key={tx.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : tx.id)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">
                      {tx.buyer || (isGift ? 'Gitt bort' : 'Ukjent kjøper')}
                    </span>
                    {isGift && (
                      <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                        Gitt bort
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {formatDate(tx.date)} · {itemCount} stk · {tx.channel}
                    {tx.carrier ? ` · ${tx.carrier}` : ''}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-display text-xl font-bold tnum ${
                    isGift ? 'text-muted' : 'text-ink'
                  }`}
                >
                  {isGift ? '–' : formatKr(tx.total)}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line p-4 anim-slide-up">
                  <ul className="space-y-2">
                    {tx.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-ink">
                            {it.styleName}
                          </span>
                          <span className="block text-muted">
                            {it.variant} · {it.size} · {it.qty} stk
                          </span>
                        </span>
                        {!isGift && (
                          <span className="shrink-0 tnum text-ink">
                            {formatKr(it.price * it.qty)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {(tx.payment || tx.carrier || tx.note) && (
                    <div className="mt-3 space-y-1 text-sm text-muted">
                      {tx.payment && <div>Betaling: {tx.payment}</div>}
                      {tx.carrier && (
                        <div>
                          Frakt: {tx.carrier}
                          {tx.trackingCode && (
                            <>
                              {' · '}
                              <span className="tnum text-ink">{tx.trackingCode}</span>
                            </>
                          )}
                        </div>
                      )}
                      {tx.note && <div>Notat: {tx.note}</div>}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(tx)}
                    className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-danger active:bg-canvas"
                  >
                    Slett
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
