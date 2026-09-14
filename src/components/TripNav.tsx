import { Icon } from './Icon'

interface Props {
  onToday: () => void
  onTop: () => void
  onOverview: () => void
  active: 'today' | 'itinerary' | 'overview'
  todayDisabled?: boolean
}

const TABS = [
  { key: 'today' as const, label: '今天', icon: 'clock' as const },
  { key: 'itinerary' as const, label: '行程', icon: 'calendar' as const },
  { key: 'overview' as const, label: '總覽', icon: 'grid' as const },
]

export function TripNav({ onToday, onTop, onOverview, active, todayDisabled }: Props) {
  const handlers = { today: onToday, itinerary: onTop, overview: onOverview }
  return (
    <nav className="bg-white border-t border-border flex sticky bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={handlers[tab.key]}
            disabled={tab.key === 'today' && todayDisabled}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-40"
          >
            <Icon name={tab.icon} size={20} className={isActive ? 'text-primary' : 'text-muted'} />
            <span className={`text-[10px] ${isActive ? 'font-bold text-primary' : 'text-text-label'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
