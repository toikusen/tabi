import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { createTrip, updateTrip } from '../lib/db'
import { todayStr } from '../lib/dates'
import { Logo } from '../components/Logo'
import { DestinationPicker } from '../components/DestinationPicker'
import type { Place } from '../lib/weather'

const plusDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return todayStr(d)
}

export function NewTripPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [startDate, setStartDate] = useState(() => todayStr())
  const [endDate, setEndDate] = useState(() => plusDays(2))
  const [place, setPlace] = useState<Place | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)

  const disabledReason = !tripName.trim()
    ? '請輸入旅程名稱'
    : !startDate || !endDate
      ? '請選擇開始與結束日期'
      : startDate > endDate
        ? '結束日期需晚於開始日期'
        : null

  const handleCreateTrip = async () => {
    if (!user?.email || disabledReason) return
    setCreating(true)
    setCreateError(false)
    try {
      const displayName = (user.user_metadata?.full_name as string) ?? user.email ?? ''
      const avatarUrl = (user.user_metadata?.avatar_url as string) ?? ''
      const id = await createTrip(tripName.trim(), displayName, avatarUrl, startDate, endDate)
      // Separate write: create_trip_rpc (018) knows nothing about a destination,
      // and losing the forecast is not a reason to fail creating the trip.
      if (place) {
        await updateTrip(id, { destination: place.name, lat: place.lat, lon: place.lon })
      }
      navigate(`/trips/${id}`, { replace: true })
    } catch {
      setCreateError(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => navigate('/')} className="text-primary text-sm flex items-center gap-0.5">
          <Icon name="chevronLeft" size={16} />
          返回
        </button>
        <h1 className="text-base font-bold text-text-strong">新增旅程</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
        <Logo size={44} />
        <div className="w-full max-w-sm flex flex-col gap-3">
          <input
            aria-label="旅程名稱"
            className="border border-border rounded-[10px] px-3 py-2.5 text-sm bg-white text-text-strong"
            placeholder="旅程名稱"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="開始日期"
              className="flex-1 border border-border rounded-[10px] px-3 py-2.5 text-sm bg-white text-text-strong"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              aria-label="結束日期"
              min={startDate || undefined}
              className="flex-1 border border-border rounded-[10px] px-3 py-2.5 text-sm bg-white text-text-strong"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <DestinationPicker
              value={place?.name ?? ''}
              onPick={setPlace}
            />
            <p className="text-[11px] text-text-label mt-1.5">目的地（選填）,填了就會顯示天氣。</p>
          </div>
          <button
            onClick={handleCreateTrip}
            disabled={creating || !!disabledReason}
            className="bg-primary text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? '建立中...' : '建立旅程'}
          </button>
          {disabledReason && <p className="text-xs text-text-label text-center">{disabledReason}</p>}
          {createError && <p className="text-xs text-danger text-center">建立失敗,請再試一次</p>}
        </div>
      </main>
    </div>
  )
}
