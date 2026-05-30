import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 anim-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
              {opts.title}
            </h2>
            {opts.message && (
              <p className="mt-2 text-sm text-muted">{opts.message}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 font-semibold text-ink active:bg-canvas"
              >
                {opts.cancelLabel ?? 'Avbryt'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold text-white ${
                  opts.danger ? 'bg-danger active:opacity-90' : 'bg-kit active:bg-kit-700'
                }`}
              >
                {opts.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
