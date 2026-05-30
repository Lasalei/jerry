import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { StyleEditor } from '../components/StyleEditor'
import { Card, ScreenHeader, Stat, controlClass } from '../components/ui'
import { SIZES, VARIANTS } from '../lib/constants'
import type { GridCell, Size, Style, Variant } from '../lib/types'

/** Colour code a stock cell: 0 = grey, ≤2 = amber, else normal. */
function cellClass(qty: number): string {
  if (qty === 0) return 'bg-canvas text-muted'
  if (qty <= 2) return 'bg-amber-bg text-amber font-semibold'
  return 'bg-kit-50 text-ink font-semibold'
}

export function Lager() {
  const { data, styleTotal, addStyle, updateStyle, deleteStyle } = useStore()
  const confirm = useConfirm()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Style | null>(null)
  const [creating, setCreating] = useState(false)

  const totalJerseys = useMemo(
    () => data.stock.reduce((sum, u) => sum + u.qty, 0),
    [data.stock],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? data.styles.filter((s) => s.name.toLowerCase().includes(q))
      : data.styles
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }, [data.styles, query])

  function stockFor(styleId: string) {
    return data.stock.filter((u) => u.style_id === styleId)
  }

  function qtyAt(styleId: string, variant: Variant, size: Size): number {
    return (
      data.stock.find(
        (u) => u.style_id === styleId && u.variant === variant && u.size === size,
      )?.qty ?? 0
    )
  }

  async function handleSaveNew(name: string, grid: GridCell[]) {
    await addStyle(name, grid)
    toast('Stil lagt til')
  }

  async function handleSaveEdit(name: string, grid: GridCell[]) {
    if (!editing) return
    await updateStyle(editing.id, name, grid)
    toast('Stil oppdatert')
  }

  async function handleDelete(style: Style) {
    const ok = await confirm({
      title: 'Slette stil?',
      message: `«${style.name}» og lagerbeholdningen slettes. Salgshistorikk beholdes.`,
      confirmLabel: 'Slett',
      danger: true,
    })
    if (ok) {
      await deleteStyle(style.id)
      toast('Stil slettet')
    }
  }

  return (
    <div className="mx-auto max-w-lg pb-4">
      <ScreenHeader
        title="Lager"
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-xl bg-kit px-3 py-2 text-sm font-semibold text-white active:bg-kit-700"
          >
            + Ny stil
          </button>
        }
      />

      <div className="space-y-3 px-4">
        <Card className="flex gap-4 p-4">
          <Stat value={totalJerseys} label="Drakter igjen" accent />
          <Stat value={data.styles.length} label="Stiler" />
        </Card>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter stil…"
          className={controlClass}
        />

        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            {data.styles.length === 0
              ? 'Ingen stiler ennå. Trykk «+ Ny stil» for å starte.'
              : 'Ingen treff.'}
          </Card>
        )}

        {filtered.map((style) => {
          const total = styleTotal(style.id)
          const isOpen = expanded === style.id
          return (
            <Card key={style.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : style.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="truncate font-semibold text-ink">{style.name}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`font-display text-xl font-bold tnum ${
                      total === 0 ? 'text-muted' : 'text-kit'
                    }`}
                  >
                    {total}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-5 w-5 text-muted transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line p-3 anim-slide-up">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-center text-sm">
                      <thead>
                        <tr>
                          <th className="p-1" />
                          {SIZES.map((s) => (
                            <th
                              key={s}
                              className="p-1 text-[11px] font-semibold uppercase text-muted"
                            >
                              {s}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {VARIANTS.map((v) => (
                          <tr key={v}>
                            <td className="whitespace-nowrap py-1 pr-2 text-left text-[11px] font-semibold text-muted">
                              {v}
                            </td>
                            {SIZES.map((s) => {
                              const q = qtyAt(style.id, v, s)
                              return (
                                <td key={s} className="p-0.5">
                                  <div
                                    className={`rounded-md py-1.5 tnum ${cellClass(q)}`}
                                  >
                                    {q}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(style)}
                      className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink active:bg-canvas"
                    >
                      Rediger
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(style)}
                      className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-danger active:bg-canvas"
                    >
                      Slett
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {creating && (
        <StyleEditor
          style={null}
          stock={[]}
          onSave={handleSaveNew}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <StyleEditor
          style={editing}
          stock={stockFor(editing.id)}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
