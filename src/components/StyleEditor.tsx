import { useMemo, useRef, useState } from 'react'
import { SIZES, VARIANTS } from '../lib/constants'
import { fileToCompressedDataUrl } from '../lib/image'
import type { GridCell, Style, StockUnit } from '../lib/types'

type GridMap = Record<string, string>

function key(variant: string, size: string) {
  return `${variant}__${size}`
}

function buildInitialGrid(stock: StockUnit[]): GridMap {
  const map: GridMap = {}
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      const unit = stock.find((u) => u.variant === variant && u.size === size)
      map[key(variant, size)] = unit && unit.qty > 0 ? String(unit.qty) : ''
    }
  }
  return map
}

/**
 * Modal editor for creating or editing a style + its 4×6 stock grid.
 * `style` null => create mode.
 */
export function StyleEditor({
  style,
  stock,
  onSave,
  onClose,
}: {
  style: Style | null
  stock: StockUnit[]
  onSave: (name: string, grid: GridCell[], imageUrl: string | null) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(style?.name ?? '')
  const [grid, setGrid] = useState<GridMap>(() => buildInitialGrid(stock))
  const [imageUrl, setImageUrl] = useState<string | null>(style?.imageUrl ?? null)
  const [imgBusy, setImgBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePickImage(file: File) {
    setImgBusy(true)
    try {
      setImageUrl(await fileToCompressedDataUrl(file))
    } catch {
      // ignore — keep the previous image
    } finally {
      setImgBusy(false)
    }
  }

  const total = useMemo(
    () => Object.values(grid).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [grid],
  )

  function setCell(variant: string, size: string, value: string) {
    const clean = value.replace(/[^0-9]/g, '')
    setGrid((prev) => ({ ...prev, [key(variant, size)]: clean }))
  }

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    const cells: GridCell[] = []
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        cells.push({ variant, size, qty: Number(grid[key(variant, size)]) || 0 })
      }
    }
    try {
      await onSave(name.trim(), cells, imageUrl)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted"
        >
          Avbryt
        </button>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">
          {style ? 'Rediger stil' : 'Ny stil'}
        </h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="text-sm font-semibold text-kit disabled:opacity-40"
        >
          Lagre
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Navn på stil
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Liverpool 24/25"
            autoFocus={!style}
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 focus:border-kit focus:outline-none focus:ring-2 focus:ring-kit-100"
          />
        </div>

        {/* Photo */}
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Bilde
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handlePickImage(file)
              e.target.value = ''
            }}
          />
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={imageUrl}
                alt=""
                className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imgBusy}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink active:bg-canvas disabled:opacity-40"
                >
                  {imgBusy ? 'Behandler…' : 'Bytt bilde'}
                </button>
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-danger active:bg-canvas"
                >
                  Fjern bilde
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={imgBusy}
              className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-kit text-sm font-semibold text-kit active:bg-kit-50 disabled:opacity-40"
            >
              {imgBusy ? 'Behandler…' : '+ Legg til bilde'}
            </button>
          )}
        </div>

        {VARIANTS.map((variant) => (
          <div key={variant} className="rounded-2xl border border-line bg-surface p-3">
            <div className="mb-2 font-semibold text-ink">{variant}</div>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((size) => (
                <label key={size} className="flex flex-col">
                  <span className="mb-1 text-[11px] font-semibold uppercase text-muted">
                    {size}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={grid[key(variant, size)]}
                    placeholder="0"
                    onChange={(e) => setCell(variant, size, e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-center tnum focus:border-kit focus:outline-none focus:ring-2 focus:ring-kit-100"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">
          Totalt på lager
        </span>
        <span className="font-display text-2xl font-bold tnum text-kit">{total}</span>
      </div>
    </div>
  )
}
