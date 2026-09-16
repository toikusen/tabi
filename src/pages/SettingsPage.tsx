import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTrip, updateTripDates, deleteTrip, removeMember, copyTrip } from '../lib/db'
import { toast } from '../lib/toast'
import { itineraryText, shareItinerary } from '../lib/share'
import { dayCount } from '../lib/dates'
import { TripCopySheet } from '../components/TripCopySheet'
import { MembersSection } from '../components/MembersSection'
import { TripNotesSection } from '../components/TripNotesSection'
import { SavedBadge } from '../components/SavedBadge'
import { ConfirmSheet } from '../components/ConfirmSheet'

export function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay } = useTrip(tripId ?? null)
  const [nameInput, setNameInput] = useState('')
  const [dates, setDates] = useState({ start: '', end: '' })
  const [dateError, setDateError] = useState<string | null>(null)
  const [saved, setSaved] = useState<'name' | 'dates' | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  useEffect(() => {
    if (trip) setDates({ start: trip.start_date, end: trip.end_date })
  }, [trip?.start_date, trip?.end_date])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const isOwner = trip?.owner_email === user?.email

  const flashSaved = (what: 'name' | 'dates') => {
    setSaved(what)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(null), 2000)
  }

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim() || nameInput.trim() === trip?.name) return
    const result = await updateTrip(tripId, { name: nameInput.trim() })
    if (result.ok) flashSaved('name')
    else toast('名稱儲存失敗,請再試一次')
  }

  const handleShare = async () => {
    if (!trip) return
    await shareItinerary(trip.name, itineraryText(trip, days, eventsByDay))
  }

  const handleSaveDates = async () => {
    if (!tripId || !dates.start || !dates.end || dates.start > dates.end) return
    if (trip && dates.start === trip.start_date && dates.end === trip.end_date) return
    try {
      const result = await updateTripDates(tripId, dates.start, dates.end)
      if (result.ok) {
        setDateError(null)
        flashSaved('dates')
      }
      else if (result.blockedDates) setDateError(`以下日期已有行程,請先清空:${result.blockedDates.join('、')}`)
      else setDateError('日期更新失敗,請再試一次')
    } catch {
      setDateError('日期更新失敗,請再試一次')
    }
  }

  const handleCopy = async (name: string, startDate: string) => {
    if (!tripId || copying) return
    setCopying(true)
    try {
      const newId = await copyTrip(tripId, name, startDate)
      if (newId) navigate(`/trips/${newId}`, { replace: true })
      else toast('複製失敗,請再試一次')
    } catch {
      toast('複製失敗,請再試一次')
    } finally {
      setCopying(false)
      setCopyOpen(false)
    }
  }

  const handleLeave = async () => {
    if (!tripId || !user?.email) return
    setConfirm(null)
    setBusy(true)
    try {
      const ok = await removeMember(tripId, user.email)
      if (ok) navigate('/', { replace: true })
      else toast('退出失敗,請再試一次')
    } catch {
      toast('退出失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!tripId || !trip) return
    setConfirm(null)
    setBusy(true)
    try {
      const ok = await deleteTrip(tripId)
      if (ok) navigate('/', { replace: true })
      else toast('刪除失敗,只有主揪可以刪除旅程')
    } catch {
      toast('刪除失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-primary -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="返回">
          <Icon name="chevronLeft" />
        </button>
        <h1 className="text-base font-bold text-text-strong">設定</h1>
      </header>

      <main className="px-4 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-[12px] p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="trip-name" className="text-xs font-semibold text-text-label">旅程名稱</label>
            {saved === 'name' && <SavedBadge />}
          </div>
          <input
            id="trip-name"
            className="w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-xs font-semibold text-text-label">旅程日期</p>
            {saved === 'dates' && <SavedBadge />}
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="開始日期"
              className="flex-1 border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong"
              value={dates.start}
              onChange={(e) => setDates(d => ({ ...d, start: e.target.value }))}
              onBlur={handleSaveDates}
            />
            <input
              type="date"
              aria-label="結束日期"
              min={dates.start || undefined}
              className="flex-1 border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong"
              value={dates.end}
              onChange={(e) => setDates(d => ({ ...d, end: e.target.value }))}
              onBlur={handleSaveDates}
            />
          </div>
          {dateError && <p className="text-xs text-danger mt-2">{dateError}</p>}
        </section>

        {trip && <TripNotesSection trip={trip} />}

        <section className="bg-white rounded-[12px] p-4 border border-border">
          <p className="text-xs font-semibold text-text-label mb-3">分享行程</p>
          <button
            onClick={handleShare}
            className="w-full border border-border text-text-strong rounded-[8px] py-2.5 text-sm font-semibold"
          >
            複製 / 分享文字行程
          </button>
          <p className="text-[11px] text-text-label mt-2">產生純文字行程,給沒有安裝 App 的人看。</p>
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-border">
          <p className="text-xs font-semibold text-text-label mb-3">複製旅程</p>
          <button
            onClick={() => setCopyOpen(true)}
            disabled={!trip}
            className="w-full border border-border text-text-strong rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            複製成新的旅程
          </button>
          <p className="text-[11px] text-text-label mt-2">同樣的行程換一組日期,適合每年固定的旅行。</p>
        </section>

        {trip && <MembersSection trip={trip} currentEmail={user?.email} />}

        <section className="bg-white rounded-[12px] p-4 border border-danger-border">
          <p className="text-xs font-semibold text-danger mb-3">危險區</p>
          {isOwner ? (
            <>
              <button
                onClick={() => setConfirm('delete')}
                disabled={busy}
                className="w-full bg-danger-surface text-danger rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? '刪除中...' : '刪除旅程'}
              </button>
              <p className="text-[11px] text-text-label mt-2">刪除前需輸入旅程名稱確認,所有行程與圖片將一併刪除。</p>
            </>
          ) : (
            <button
              onClick={() => setConfirm('leave')}
              disabled={busy}
              className="w-full bg-danger-surface text-danger rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '退出中...' : '退出旅程'}
            </button>
          )}
        </section>
      </main>

      {copyOpen && trip && (
        <TripCopySheet
          sourceName={trip.name}
          dayCount={dayCount(trip.start_date, trip.end_date)}
          busy={copying}
          onCopy={handleCopy}
          onClose={() => setCopyOpen(false)}
        />
      )}

      {confirm === 'delete' && trip && (
        <ConfirmSheet
          title="刪除旅程"
          description="此動作無法復原,所有行程與圖片將一併刪除。"
          confirmLabel="刪除旅程"
          requireTypedText={trip.name}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'leave' && (
        <ConfirmSheet
          title="確定要退出這個旅程?"
          description="退出後就看不到這趟的行程了。"
          confirmLabel="退出旅程"
          destructive
          onConfirm={handleLeave}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
