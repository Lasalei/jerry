import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

interface ToastState {
  id: number
  message: string
  kind: 'success' | 'error'
}

type ToastFn = (message: string, kind?: 'success' | 'error') => void

const ToastContext = createContext<ToastFn | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const show = useCallback<ToastFn>((message, kind = 'success') => {
    const id = Date.now()
    setToast({ id, message, kind })
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div
            className={`anim-slide-up rounded-xl px-4 py-3 text-center font-semibold text-white shadow-lg ${
              toast.kind === 'success' ? 'bg-kit-700' : 'bg-danger'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
