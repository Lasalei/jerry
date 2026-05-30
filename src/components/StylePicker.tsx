import { useMemo, useRef, useState } from 'react'
import type { Style } from '../lib/types'
import { controlClass } from './ui'

/**
 * Searchable style picker. Uses a text input + filtered list rather than a
 * native <select> because there can be ~50 styles and search matters more than
 * the OS wheel here.
 */
export function StylePicker({
  styles,
  value,
  onChange,
  styleTotal,
  placeholder = 'Søk etter stil…',
}: {
  styles: Style[]
  value: string
  onChange: (styleId: string) => void
  styleTotal: (id: string) => number
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = styles.find((s) => s.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? styles.filter((s) => s.name.toLowerCase().includes(q))
      : styles
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }, [styles, query])

  function pick(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={controlClass}
        placeholder={placeholder}
        value={open ? query : selected?.name ?? ''}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onBlur={() => {
          // Delay so an option's onMouseDown/click can register first.
          window.setTimeout(() => setOpen(false), 120)
        }}
      />

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface shadow-lg anim-pop">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted">Ingen treff</div>
          )}
          {filtered.map((s) => {
            const total = styleTotal(s.id)
            return (
              <button
                key={s.id}
                type="button"
                // onMouseDown fires before input blur, keeping the pick reliable.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s.id)
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-kit-50 ${
                  s.id === value ? 'bg-kit-50' : ''
                }`}
              >
                <span className="truncate text-ink">{s.name}</span>
                <span
                  className={`shrink-0 text-sm tnum ${
                    total === 0 ? 'text-muted' : 'text-kit'
                  }`}
                >
                  {total} igj.
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
