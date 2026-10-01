import { useState } from 'react'
import { useStore } from '../store'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { ValueChips } from '../components/ValueChips'
import { controlClass } from '../components/ui'
import type { AppConfig, ProductField } from '../lib/types'

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

  const canSave =
    productLabel.trim() !== '' &&
    field1.name.trim() !== '' &&
    field1.values.length > 0 &&
    (!hasField2 || (field2.name.trim() !== '' && field2.values.length > 0)) &&
    !saving

  async function handleSave() {
    if (!canSave) return

    // The values here are only defaults for NEW products, so editing them never
    // touches existing stock. Switching the second field on/off does, though:
    // existing SKUs were saved with (or without) a field2 value and get hidden.
    const hadField2 = data.config.field2 !== null
    if (hasField2 !== hadField2 && data.stock.some((u) => u.qty > 0)) {
      const ok = await confirm({
        title: hasField2 ? 'Slå på felt 2?' : 'Slå av felt 2?',
        message: hasField2
          ? `Eksisterende beholdning er registrert uten ${field2.name.trim() || 'felt 2'}. Den vises som en egen kolonne «–» til du redigerer produktene.`
          : `Beholdning registrert med ${data.config.field2?.name ?? 'felt 2'} skjules fra lageret. Ingenting slettes, og alt kommer tilbake om du slår feltet på igjen.`,
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
          Tilpass hva et produkt heter og hvilke felter det har. Verdiene under er{' '}
          <strong>standardverdier</strong>: de forhåndsutfylles når du lager et nytt
          produkt, og hvert produkt kan deretter legge til eller fjerne egne verdier.
        </p>

        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Hva kalles ett produkt?
          </span>
          <input
            type="text"
            value={productLabel}
            onChange={(e) => setProductLabel(e.target.value)}
            placeholder="f.eks. Produkt eller Vare"
            className={controlClass}
          />
          <p className="mt-1 text-xs text-muted">
            Ett kort ord. Det settes inn i tekster som «+ Ny {productLabel.trim().toLowerCase() || '…'}»
            og «Navn på {productLabel.trim().toLowerCase() || '…'}».
          </p>
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
            placeholder="Feltnavn, f.eks. Variant / Farge / Kategori"
            className={`${controlClass} mb-3`}
          />
          <span className="mb-1 block text-xs text-muted">Standardverdier for nye produkter</span>
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
              <span className="mb-1 block text-xs text-muted">
                Standardverdier for nye produkter
              </span>
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
