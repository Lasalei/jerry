import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Shows a small banner when a new version of the app has been deployed (the
 * service worker has fetched fresh files). Tapping "Oppdater" activates the new
 * version and reloads. Also confirms when the app is ready to work offline.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
      <div className="anim-slide-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg">
        <span className="flex-1 text-sm text-ink">
          {needRefresh ? 'Ny versjon tilgjengelig' : 'Klar for offline-bruk'}
        </span>
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded-xl bg-kit px-3 py-2 text-sm font-semibold text-white active:bg-kit-700"
          >
            Oppdater
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted active:bg-canvas"
        >
          {needRefresh ? 'Senere' : 'OK'}
        </button>
      </div>
    </div>
  )
}
