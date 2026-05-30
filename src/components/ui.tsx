import type { ReactNode, SelectHTMLAttributes } from 'react'

/** White rounded card — the standard surface. */
export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-surface border border-line ${className}`}
    >
      {children}
    </div>
  )
}

/** Form field wrapper with a small uppercase label. */
export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

const controlClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-3 text-ink ' +
  'focus:outline-none focus:border-kit focus:ring-2 focus:ring-kit-100'

/** Native <select> — gives the OS wheel picker on mobile. */
export function NativeSelect({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={`${controlClass} appearance-none bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6b64' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1.15rem',
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export { controlClass }

/** Big primary action button. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-kit px-4 py-4 text-center font-display text-lg font-semibold uppercase tracking-wide text-white transition-colors active:bg-kit-700 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** A labelled summary statistic with a big tabular number. */
export function Stat({
  value,
  label,
  accent = false,
}: {
  value: ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex-1">
      <div
        className={`font-display text-3xl font-bold tnum leading-none ${
          accent ? 'text-kit' : 'text-ink'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  )
}

/** Screen header bar. */
export function ScreenHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
        {title}
      </h1>
      {action}
    </div>
  )
}
