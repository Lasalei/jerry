import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { controlClass } from '../components/ui'
import type { AppConfig, ProductField } from '../lib/types'

/** Editable list of values shown as removable chips + an add box. */
function ValueChips({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v || values.includes(v)) {
      setDraft('')
      return
    }
    onChange([...values, v])
    setDraft('')
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.length === 0 && (
          <span className="text-sm text-muted">Ingen verdier ennå</span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-lg bg-kit-50 py-1 pl-3 pr-1.5 text-sm text-ink"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Fjern ${v}`}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted active:bg-kit-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Legg til verdi…"
          className={controlClass}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-xl border border-kit px-4 font-semibold text-kit active:bg-kit-50"
        >
          Legg til
        </button>
      </div>
    </div>
  )
}

/** All field/axis values currently referenced by existing stock or history. */
function usedValues(
  axis: 'variant' | 'size',
  stock: { variant: string; size: string }[],
  items: { variant: string; size: string }[],
): Set<string> {
  const used = new Set<string>()
  for (const u of stock) if (u[axis]) used.add(u[axis])
  for (const it of items) if (it[axis]) used.add(it[axis])
  return used
}

export function Innstillinger({ onClose }: { onClose: () => void }) {
  const { data, saveConfig } = useStore()
  const confirm = useConfirm()
  const toast = useToast()

  const [productLabel, setProductLabel] = useState(data.config.productLabel)
  const [field1, setField1] = useState<ProductField>(data.config.field1)
  const [hasField2, setHasField2] = useState(data.config.field2 !== null)
  const [field2, setField2] = useState<ProductField>(
    data.config.field2 ?? { name: 'Felt 2', values: [] },
  )
  const [saving, setSaving] = useState(false)

  const allItems = useMemo(
    () => data.transactions.flatMap((t) => t.items),
    [data.transactions],
  )

  const canSave =
    productLabel.trim() !== '' &&
    field1.name.trim() !== '' &&
    field1.values.length > 0 &&
    (!hasField2 || (field2.name.trim() !== '' && field2.values.length > 0)) &&
    !saving

  async function handleSave() {
    if (!canSave) return

    // Warn if removing a value that existing stock/history uses — that stock
    // becomes hidden (not deleted). field1 → variant column, field2 → size.
    const usedV = usedValues('variant', data.stock, allItems)
    const usedS = usedValues('size', data.stock, allItems)
    const droppedV = [...usedV].filter((v) => !field1.values.includes(v))
    const droppedS = hasField2
      ? [...usedS].filter((s) => !field2.values.includes(s))
      : data.config.field2
        ? [...usedS] // turning a two-field workspace into one hides all field2 stock
        : []
    const dropped = [...droppedV, ...droppedS].filter(Boolean)

    if (dropped.length > 0) {
      const ok = await confirm({
        title: 'Endre felter?',
        message: `Disse verdiene er i bruk og vil bli skjult fra lageret: ${dropped.join(
          ', ',
        )}. Beholdningen slettes ikke, men vises ikke før verdien legges til igjen.`,
        confirmLabel: 'Lagre likevel',
        danger: true,
      })
      if (!ok) return
    }

    setSaving(true)
    const config: AppConfig = {
      productLabel: productLabel.trim(),
      field1: { name: field1.name.trim(), values: field1.values },
      field2: hasField2
        ? { name: field2.name.trim(), values: field2.values }
        : null,
    }
    try {
      await saveConfig(config)
      toast('Innstillinger lagret')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
          Avbryt
        </button>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">
          Innstillinger
        </h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm font-semibold text-kit disabled:opacity-40"
        >
          Lagre
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-auto p-4">
        <p className="text-sm text-muted">
          Tilpass hva et produkt heter og hvilke felter det har. Endringer gjelder
          hele arbeidsområdet og synkroniseres til alle som bruker det.
        </p>

        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Hva kalles ett produkt?
          </span>
          <input
            type="text"
            value={productLabel}
            onChange={(e) => setProductLabel(e.target.value)}
            placeholder="f.eks. Stil, Produkt, Vare"
            className={controlClass}
          />
        </div>

        {/* Field 1 */}
        <div className="rounded-2xl border border-line bg-surface p-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Felt 1 (påkrevd)
          </span>
          <input
            type="text"
            value={field1.name}
            onChange={(e) => setField1({ ...field1, name: e.target.value })}
            placeholder="Feltnavn, f.eks. Variant / Kategori"
            className={`${controlClass} mb-3`}
          />
          <ValueChips
            values={field1.values}
            onChange={(values) => setField1({ ...field1, values })}
          />
        </div>

        {/* Field 2 (optional) */}
        <div className="rounded-2xl border border-line bg-surface p-3">
          <label className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Felt 2 (valgfritt)
            </span>
            <button
              type="button"
              onClick={() => setHasField2((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                hasField2 ? 'bg-kit' : 'bg-line'
              }`}
              aria-pressed={hasField2}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  hasField2 ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
          {hasField2 && (
            <>
              <input
                type="text"
                value={field2.name}
                onChange={(e) => setField2({ ...field2, name: e.target.value })}
                placeholder="Feltnavn, f.eks. Størrelse / Tilstand"
                className={`${controlClass} mb-3`}
              />
              <ValueChips
                values={field2.values}
                onChange={(values) => setField2({ ...field2, values })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
