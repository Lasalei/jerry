import type { ReactNode } from 'react'

export type TabId = 'salg' | 'lager' | 'ordre' | 'logg' | 'mer'

interface Tab {
  id: TabId
  label: string
  icon: ReactNode
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    {path}
  </svg>
)

const TABS: Tab[] = [
  {
    id: 'salg',
    label: 'Nytt salg',
    icon: icon(<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  },
  {
    id: 'lager',
    label: 'Lager',
    icon: icon(<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>),
  },
  {
    id: 'ordre',
    label: 'Ordre',
    icon: icon(<><path d="M3 7h13v8H3z" /><path d="M16 10h3l2 3v2h-5z" /><circle cx="7" cy="17" r="1.6" /><circle cx="17" cy="17" r="1.6" /></>),
  },
  {
    id: 'logg',
    label: 'Logg',
    icon: icon(<><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h10" /></>),
  },
  {
    id: 'mer',
    label: 'Mer',
    icon: icon(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>),
  },
]

export function BottomNav({
  active,
  onChange,
  badges,
}: {
  active: TabId
  onChange: (id: TabId) => void
  badges?: Partial<Record<TabId, number>>
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div
        className="mx-auto flex max-w-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active
          const badge = badges?.[tab.id] ?? 0
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                isActive ? 'text-kit' : 'text-muted'
              }`}
            >
              <span className="relative">
                {tab.icon}
                {badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-kit px-1 text-[10px] font-bold leading-none text-white tnum">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
