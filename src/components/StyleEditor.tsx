import { useRef, useState } from 'react'
import { useConfirm } from './Confirm'
import { ValueChips } from './ValueChips'
import { axesFor, axisLabel, cellKey, hasSecondAxis } from '../lib/axes'
import { useConfig } from '../store'
import { fileToCompressedDataUrl } from '../lib/image'
import type { AppConfig, GridCell, Style, StyleInput, StockUnit } from '../lib/types'

type GridMap = Record<string, string>

/** Tailwind needs literal class names; index = column count - 1 (capped at 4). */
const COLS_CLASS = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4']

function initialAxes(style: Style | null, stock: StockUnit[], config: AppConfig) {
  if (style) return axesFor(style, stock, config)
  // New product: start from the workspace defaults, then edit freely.
  return {
    v1: [...config.field1.values],
    v2: config.field2 ? [...config.field2.values] : [''],
  }
}

function initialGrid(style: Style | null, stock: StockUnit[]): GridMap {
  const map: GridMap = {}
  if (!style) return map
  // Keep EVERY existing SKU (not just the visible axes) so a value that is
  // removed and re-added before saving gets its quantity back.
  for (const u of stock) {
    if (u.style_id === style.id) map[cellKey(u.variant, u.size)] = u.qty > 0 ? String(u.qty) : ''
  }
  return map
}

/**
 * Modal editor for creating or editing a product + its stock.
 *
 * The product owns its grid axes: the field1 values are its rows and the field2
 * values its columns, both editable right here (add / remove). The workspace
 * config only supplies the field names and the defaults a new product starts with.
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
  onSave: (input: StyleInput, grid: GridCell[]) => Promise<void>
  onClose: () => void
}) {
  const config = useConfig()
  const confirm = useConfirm()
  const twoFields = config.field2 !== null
  const label = config.productLabel.toLowerCase()

  const [name, setName] = useState(style?.name ?? '')
  const [variants, setVariants] = useState<string[]>(
    () => initialAxes(style, stock, config).v1,
  )
  // Per product: does it use the second field at all? (Electronics: no sizes.)
  const [useSizes, setUseSizes] = useState<boolean>(() =>
    twoFields && (style ? hasSecondAxis(initialAxes(style, stock, config)) : true),
  )
  const [sizes, setSizes] = useState<string[]>(() => {
    if (!twoFields) return []
    const axes = initialAxes(style, stock, config)
    // A product without sizes starts from the defaults if sizes get switched on.
    return hasSecondAxis(axes) ? axes.v2 : [...config.field2!.values]
  })
  const [grid, setGrid] = useState<GridMap>(() => initialGrid(style, stock))
  const [imageUrl, setImageUrl] = useState<string | null>(style?.imageUrl ?? null)
  const [imgBusy, setImgBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Columns of the grid: the product's sizes, or one synthetic '' column.
  const grid2D = twoFields && useSizes
  const cols = grid2D ? sizes : ['']
  const field2Lower = (config.field2?.name ?? '').toLowerCase()

  function qtyAt(variant: string, size: string): number {
    return Number(grid[cellKey(variant, size)]) || 0
  }
  function rowQty(variant: string): number {
    return cols.reduce((sum, s) => sum + qtyAt(variant, s), 0)
  }
  function colQty(size: string): number {
    return variants.reduce((sum, v) => sum + qtyAt(v, size), 0)
  }

  const total = variants.reduce((sum, v) => sum + rowQty(v), 0)

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

  function setCell(variant: string, size: string, value: string) {
    const clean = value.replace(/[^0-9]/g, '')
    setGrid((prev) => ({ ...prev, [cellKey(variant, size)]: clean }))
  }

  /** Veto removing a value that still holds stock unless the user confirms. */
  async function confirmRemoval(
    fieldName: string,
    removed: string[],
    qtyOf: (v: string) => number,
  ): Promise<boolean> {
    for (const v of removed) {
      const q = qtyOf(v)
      if (q === 0) continue
      const ok = await confirm({
        title: `Fjerne ${fieldName.toLowerCase()} «${axisLabel(v)}»?`,
        message: `${q} stk på lager under denne verdien slettes når du lagrer.`,
        confirmLabel: 'Fjern',
        danger: true,
      })
      if (!ok) return false
    }
    return true
  }

  async function changeVariants(next: string[]) {
    const removed = variants.filter((v) => !next.includes(v))
    if (await confirmRemoval(config.field1.name, removed, rowQty)) setVariants(next)
  }

  async function changeSizes(next: string[]) {
    const removed = sizes.filter((s) => !next.includes(s))
    if (await confirmRemoval(config.field2?.name ?? '', removed, colQty)) setSizes(next)
  }

  /** Quantity a row holds in real size cells (ignoring the '' no-size cell). */
  function sizeSum(variant: string): number {
    return sizes.filter((s) => s !== '').reduce((sum, s) => sum + qtyAt(variant, s), 0)
  }

  /** Switch the second field on/off for this product. */
  async function toggleSizes() {
    if (useSizes) {
      // Off: fold each row's per-size quantities into its single '' cell — nothing
      // lost. The size cells stay in `grid` so switching back on is a clean undo.
      const merged: GridMap = { ...grid }
      for (const v of variants) {
        const sum = cols.includes('') ? rowQty(v) : rowQty(v) + qtyAt(v, '')
        merged[cellKey(v, '')] = sum > 0 ? String(sum) : ''
      }
      setGrid(merged)
      setUseSizes(false)
      return
    }
    if (!sizes.includes('')) {
      // On: a '' cell that only mirrors quantities already in size cells (folded
      // earlier in this session) is dropped silently. Only quantities with no size
      // cells behind them (a product saved without sizes) are really at risk.
      const loose = variants.reduce(
        (sum, v) => sum + (sizeSum(v) === 0 ? qtyAt(v, '') : 0),
        0,
      )
      if (loose > 0) {
        const ok = await confirm({
          title: `Slå på ${field2Lower}?`,
          message: `${loose} stk er registrert uten ${field2Lower} og fjernes når du lagrer. Fyll inn antall per ${field2Lower} etterpå.`,
          confirmLabel: 'Slå på',
          danger: true,
        })
        if (!ok) return
      }
      const cleared: GridMap = { ...grid }
      for (const v of variants) cleared[cellKey(v, '')] = ''
      setGrid(cleared)
    }
    setUseSizes(true)
  }

  const canSave =
    name.trim() !== '' &&
    variants.length > 0 &&
    (!grid2D || sizes.length > 0) &&
    !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const cells: GridCell[] = []
    for (const variant of variants) {
      for (const size of cols) {
        cells.push({ variant, size, qty: qtyAt(variant, size) })
      }
    }
    try {
      await onSave(
        { name: name.trim(), imageUrl, variants, sizes: grid2D ? sizes : [] },
        cells,
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const gridReady = variants.length > 0 && cols.length > 0
  const colsClass = COLS_CLASS[Math.min(cols.length, COLS_CLASS.length) - 1]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
          Avbryt
        </button>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">
          {style ? `Rediger ${label}` : `Ny ${label}`}
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
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Navn på {label}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Nike svart t-skjorte"
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

        {/* This product's own axes */}
        <div className="rounded-2xl border border-line bg-surface p-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            {config.field1.name}
          </span>
          <p className="mb-2 text-xs text-muted">
            {grid2D ? 'Radene' : 'Linjene'} i lageret for dette produktet. Legg til så mange du
            vil.
          </p>
          <ValueChips
            values={variants}
            onChange={(next) => void changeVariants(next)}
            placeholder={`Ny ${config.field1.name.toLowerCase()}…`}
            emptyText={`Legg til minst én ${config.field1.name.toLowerCase()}`}
          />
        </div>

        {twoFields && (
          <div className="rounded-2xl border border-line bg-surface p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {config.field2!.name}
              </span>
              <button
                type="button"
                onClick={() => void toggleSizes()}
                aria-pressed={useSizes}
                aria-label={`Bruker ${config.field2!.name}`}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  useSizes ? 'bg-kit' : 'bg-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    useSizes ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {useSizes ? (
              <>
                <p className="mb-2 text-xs text-muted">
                  Kolonnene i lageret for dette produktet, f.eks. XS, S, M, L, XL.
                </p>
                <ValueChips
                  values={sizes}
                  onChange={(next) => void changeSizes(next)}
                  placeholder={`Ny ${field2Lower}…`}
                  emptyText={`Legg til minst én ${field2Lower}`}
                />
              </>
            ) : (
              <p className="text-xs text-muted">
                Ingen {field2Lower} for dette produktet. Antall telles per{' '}
                {config.field1.name.toLowerCase()}. Passer for f.eks. elektronikk og
                diverse.
              </p>
            )}
          </div>
        )}

        {/* Stock inputs: a field1×field2 grid, or a simple list when single-field */}
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
            Antall på lager
          </span>
          {!gridReady ? (
            <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">
              Legg til {config.field1.name.toLowerCase()}
              {grid2D ? ` og ${field2Lower}` : ''} over for å fylle inn antall.
            </div>
          ) : grid2D ? (
            <div className="space-y-3">
              {variants.map((variant) => (
                <div key={variant} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-ink">{axisLabel(variant)}</span>
                    <span className="text-xs tnum text-muted">{rowQty(variant)} stk</span>
                  </div>
                  <div className={`grid ${colsClass} gap-2`}>
                    {cols.map((size) => (
                      <label key={size} className="flex flex-col">
                        <span className="mb-1 truncate text-center text-[11px] font-semibold uppercase text-muted">
                          {axisLabel(size)}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={grid[cellKey(variant, size)] ?? ''}
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
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="space-y-2">
                {variants.map((variant) => (
                  <label key={variant} className="flex items-center justify-between gap-3">
                    <span className="text-ink">{axisLabel(variant)}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={grid[cellKey(variant, '')] ?? ''}
                      placeholder="0"
                      onChange={(e) => setCell(variant, '', e.target.value)}
                      className="w-24 rounded-lg border border-line bg-surface px-2 py-2 text-center tnum focus:border-kit focus:outline-none focus:ring-2 focus:ring-kit-100"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
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
