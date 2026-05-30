/** − n + stepper with big tap targets. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))

  return (
    <div className="flex items-center rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Færre"
        className="flex h-12 w-12 items-center justify-center text-2xl text-ink disabled:opacity-30"
      >
        −
      </button>
      <div className="min-w-10 flex-1 text-center font-display text-xl font-semibold tnum">
        {value}
      </div>
      <button
        type="button"
        onClick={inc}
        disabled={max !== undefined && value >= max}
        aria-label="Flere"
        className="flex h-12 w-12 items-center justify-center text-2xl text-ink disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}
