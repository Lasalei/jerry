import { useState } from 'react'
import { BottomNav, type TabId } from './components/BottomNav'
import { ConfirmProvider } from './components/Confirm'
import { ToastProvider } from './components/Toast'
import { Gate } from './components/Gate'
import { UpdatePrompt } from './components/UpdatePrompt'
import { NyttSalg } from './screens/NyttSalg'
import { Lager } from './screens/Lager'
import { Ordre } from './screens/Ordre'
import { Logg } from './screens/Logg'
import { Mer } from './screens/Mer'
import { Innstillinger } from './screens/Innstillinger'
import { useStore } from './store'

function Screen({ tab, onOpenSettings }: { tab: TabId; onOpenSettings: () => void }) {
  switch (tab) {
    case 'salg':
      return <NyttSalg />
    case 'lager':
      return <Lager />
    case 'ordre':
      return <Ordre />
    case 'logg':
      return <Logg />
    case 'mer':
      return <Mer onOpenSettings={onOpenSettings} />
  }
}

export default function App() {
  const [tab, setTab] = useState<TabId>('salg')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { loading, data } = useStore()

  // Outstanding orders = a shipping carrier set and not yet handled.
  const outstandingOrders = data.transactions.filter(
    (t) => t.carrier !== null && !t.sent,
  ).length

  return (
    <Gate>
      <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-dvh bg-canvas">
          {/* pad bottom so content clears the fixed nav */}
          <main className="pb-24">
            {loading ? (
              <div className="flex h-dvh items-center justify-center text-muted">
                Laster…
              </div>
            ) : (
              <Screen tab={tab} onOpenSettings={() => setSettingsOpen(true)} />
            )}
          </main>
          <BottomNav
            active={tab}
            onChange={setTab}
            badges={{ ordre: outstandingOrders }}
          />
          <UpdatePrompt />
          {settingsOpen && <Innstillinger onClose={() => setSettingsOpen(false)} />}
        </div>
      </ConfirmProvider>
      </ToastProvider>
    </Gate>
  )
}
