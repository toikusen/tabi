import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listMyTrips, type TripSummary } from '../lib/db'
import { fmtRange, dayCount, tripStatus, daysUntil, sortTrips } from '../lib/dates'
import { Icon } from '../components/Icon'
import { AvatarStack } from '../components/AvatarStack'
import { AccountSheet } from '../components/AccountSheet'
import { InstallPrompt } from '../components/InstallPrompt'
import { Logo } from '../components/Logo'

const TRIPS_CACHE = 'sb_trips_list'

function readTripsCache(): TripSummary[] | null {
  try {
    const raw = localStorage.getItem(TRIPS_CACHE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TripSummary[]
    // Older cache entries lack the members field
    return parsed.map(t => ({ ...t, members: t.members ?? [] }))
  } catch {
    return null
  }
}

/** Trailing block that spells out the countdown: "出發倒數 48 天", "旅行中 第 2 天". */
function TripCountdown({ start, status }: { start: string; status: 'upcoming' | 'ongoing' }) {
  const days = daysUntil(start)
  const num = (n: number) => <span className="text-xl font-bold leading-none">{n}</span>

  return (
    <div className={`shrink-0 text-right ${status === 'ongoing' ? 'text-ok' : 'text-primary'}`}>
      <p className="text-[10px] font-bold text-text-label">{status === 'ongoing' ? '旅行中' : '出發倒數'}</p>
      <p className="text-xs font-bold mt-1">
        {status === 'ongoing' ? <>第 {num(1 - days)} 天</>
          : days === 1 ? <span className="text-base leading-none">明天</span>
          : <>{num(days)} 天</>}
      </p>
    </div>
  )
}

function TripCard({ trip, onClick }: { trip: TripSummary; onClick: () => void }) {
  const status = tripStatus(trip.start_date, trip.end_date)
  const ended = status === 'ended'

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-[12px] p-4 shadow-card text-left active:opacity-70 flex items-center gap-3 ${ended ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-strong truncate">{trip.name}</p>
        <p className="text-xs text-text-label mt-1">
          {fmtRange(trip.start_date, trip.end_date)} ·{dayCount(trip.start_date, trip.end_date)} 天
        </p>
        {!ended && trip.members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AvatarStack members={trip.members} />
            <span className="text-[11px] text-text-label">{trip.members.length} 位旅伴</span>
          </div>
        )}
      </div>
      {!ended && <TripCountdown start={trip.start_date} status={status} />}
      <Icon name="chevronRight" size={16} className="shrink-0 text-icon-muted" />
    </button>
  )
}

export function TripListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripSummary[] | null>(readTripsCache)
  const [loadError, setLoadError] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    listMyTrips()
      .then((t) => {
        setTrips(t)
        localStorage.setItem(TRIPS_CACHE, JSON.stringify(t))
      })
      .catch(() => {
        setLoadError(true)
        setTrips(prev => prev ?? [])
      })
  }, [])

  const { ongoing, upcoming, ended } = sortTrips(trips ?? [])
  const active = [...ongoing, ...upcoming]

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-base font-bold text-text-strong">Tabi</span>
        </div>
        <button onClick={() => setAccountOpen(true)} aria-label="帳號設定" className="w-11 h-11 -my-1.5 -mr-2 flex items-center justify-center active:opacity-70">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-bg-accent text-primary text-xs font-bold flex items-center justify-center">
              {(user?.user_metadata?.full_name as string || user?.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 flex flex-col gap-3">
        <h1 className="text-sm font-bold text-text-strong">我的旅程</h1>
        {trips === null && <p className="text-sm text-text-label text-center py-8">載入中...</p>}

        {loadError && (
          <p className="text-xs text-danger text-center">無法載入旅程列表,請檢查網路連線</p>
        )}

        {trips?.length === 0 && !loadError && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Logo size={44} />
            <p className="text-sm text-text-label">還沒有旅程</p>
            <button
              onClick={() => navigate('/trips/new')}
              className="bg-primary text-white rounded-[10px] py-3 px-6 text-sm font-semibold active:opacity-80"
            >
              建立第一個旅程
            </button>
          </div>
        )}

        {active.map((trip) => (
          <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
        ))}

        {ended.length > 0 && (
          <p className="text-[11px] font-bold text-text-label tracking-wide mt-2">已結束</p>
        )}
        {ended.map((trip) => (
          <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
        ))}
      </main>

      {!!trips?.length && (
        <button
          onClick={() => navigate('/trips/new')}
          aria-label="新增旅程"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-16rem+1.25rem))] w-[52px] h-[52px] rounded-full bg-primary text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,119,182,0.4)] active:opacity-80 z-20"
        >
          <Icon name="plus" size={22} />
        </button>
      )}

      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}

      <InstallPrompt />
    </div>
  )
}
