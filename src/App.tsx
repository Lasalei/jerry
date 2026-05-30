import { useState } from 'react'
import { BottomNav, type TabId } from './components/BottomNav'
import { ConfirmProvider } from './components/Confirm'
import { ToastProvider } from './components/Toast'
import { Gate } from './components/Gate'
import { UpdatePrompt } from './components/UpdatePrompt'
import { NyttSalg } from './screens/NyttSalg'
import { Lager } from './screens/Lager'
import { Logg } from './screens/Logg'
import { Mer } from './screens/Mer'
import { useStore } from './store'

function Screen({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'salg':
      return <NyttSalg />
    case 'lager':
      return <Lager />
    case 'logg':
      return <Logg />
    case 'mer':
      return <Mer />
  }
}

export default function App() {
  const [tab, setTab] = useState<TabId>('salg')
  const { loading } = useStore()

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
              <Screen tab={tab} />
            )}
          </main>
          <BottomNav active={tab} onChange={setTab} />
          <UpdatePrompt />
        </div>
      </ConfirmProvider>
      </ToastProvider>
    </Gate>
  )
}
