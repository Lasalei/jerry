import { useState } from 'react'
import { axisLabel, insertValue } from '../lib/axes'
import { controlClass } from './ui'

/**
 * Editable list of values shown as removable chips + an add box. Used both for
 * the workspace defaults (Innstillinger) and a product's own axes (StyleEditor).
 * Removal goes through `onChange` with the value missing, so the parent can veto
 * it (e.g. confirm when stock would be lost). Size-like lists stay in size order
 * (see insertValue); anything else keeps the order values were added in.
 */
export function ValueChips({
  values,
  onChange,
  placeholder = 'Legg til verdi…',
  emptyText = 'Ingen verdier ennå',
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyText?: string
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v || values.includes(v)) {
      setDraft('')
      return
    }
    onChange(insertValue(values, v))
    setDraft('')
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.length === 0 && <span className="text-sm text-muted">{emptyText}</span>}
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-lg bg-kit-50 py-1 pl-3 pr-1.5 text-sm text-ink"
          >
            {axisLabel(v)}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Fjern ${axisLabel(v)}`}
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
          placeholder={placeholder}
          enterKeyHint="done"
          className={controlClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="shrink-0 rounded-xl border border-kit px-4 font-semibold text-kit active:bg-kit-50 disabled:opacity-40"
        >
          Legg til
        </button>
      </div>
    </div>
  )
}
