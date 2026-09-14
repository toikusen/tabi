import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, KeyboardSensor, MeasuringStrategy,
  useSensor, useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { fmtChip, scrollTargetEventId, todayStr, tripStatus } from '../lib/dates'
import { Icon } from '../components/Icon'
import { SyncIndicator } from '../components/SyncIndicator'
import { AvatarStack } from '../components/AvatarStack'
import { TripNav } from '../components/TripNav'
import { DaySection } from '../components/DaySection'
import { WishlistSection } from '../components/WishlistSection'
import { WISHLIST } from '../lib/db'
import { useTripDnd } from '../hooks/useTripDnd'
import { cardsOverContainers, type EventsByDay } from '../lib/dnd'
import { InstallPrompt } from '../components/InstallPrompt'
import { InviteCard } from '../components/InviteCard'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()
  const [activeDay, setActiveDay] = useState<string | null>(null)

  const scrolledRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    // 鍵盤排序:focus 把手後空白鍵拿起、方向鍵移動、空白鍵放下
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /** Every drop target, including the days that have no events yet — a day
   *  missing from the map could not be dragged into. */
  const containers = useMemo<EventsByDay>(() => {
    const map: EventsByDay = { [WISHLIST]: eventsByDay[WISHLIST] ?? [] }
    for (const day of days) map[day.id] = eventsByDay[day.id] ?? []
    return map
  }, [days, eventsByDay])

  const { byDay, handleDragStart, handleDragOver, handleDragEnd } =
    useTripDnd(containers, tripId ?? '')

  /** Brings the first event that has not ended into view under the sticky header.
   *  Returns false when there is nothing to scroll to, so the initial scroll can
   *  retry on the next data update. Shared by that initial scroll and the 今天 tab. */
  const scrollToNow = useCallback(() => {
    const targetId = scrollTargetEventId({ days, eventsByDay, now: new Date() })
    if (!targetId) return false

    const el = document.getElementById(`event-${targetId}`)
    if (!el) return false

    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 96
    el.style.scrollMarginTop = `${headerHeight + 8}px`
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return true
  }, [days, eventsByDay])

  useEffect(() => {
    if (scrolledRef.current || !days.length) return
    scrolledRef.current = scrollToNow()
  }, [days.length, scrollToNow])

  const today = todayStr()
  const highlighted = activeDay ?? days.find(d => d.date === today)?.id ?? null

  /** Day titles widen the chips, so today's can start off-screen. Sets
   *  scrollLeft instead of scrollIntoView, which would also move the page
   *  while it is smooth-scrolling toward that day. */
  const chipRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = chipRowRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-current]')
    if (!row || !chip) return
    row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2
  }, [highlighted, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-text-label">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  const isOngoing = tripStatus(trip.start_date, trip.end_date) === 'ongoing'

  const scrollToDay = (dayId: string) => {
    setActiveDay(dayId)
    document.getElementById(`day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      {/* z-20 keeps the chrome above the cards' drag handles (z-10); at an
          equal z-index the later-in-DOM handle would paint over the chips. */}
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/')} className="text-primary shrink-0 -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="回旅程列表">
              <Icon name="chevronLeft" />
            </button>
            <h1 className="text-base font-bold text-text-strong truncate">{trip.name}</h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <SyncIndicator status={syncStatus} />
            <button onClick={() => navigate(`/trips/${trip.id}/settings`)} aria-label="旅伴" className="flex items-center">
              {trip.members.length > 0 ? (
                <AvatarStack members={trip.members} size={24} max={3} />
              ) : (
                user?.user_metadata?.avatar_url && (
                  <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
                )
              )}
            </button>
            <button
              onClick={() => navigate(`/trips/${trip.id}/settings`)}
              aria-label="旅程設定"
              className="text-text-label w-8 h-8 flex items-center justify-center"
            >
              <Icon name="settings" />
            </button>
          </div>
        </div>
        {/* 日期膠囊列:點一下直達該天 */}
        {days.length > 1 && (
          <div ref={chipRowRef} className="relative flex gap-1.5 px-4 pb-2.5 pt-1 overflow-x-auto [scrollbar-width:none]">
            {days.map((day) => {
              const isActive = day.id === highlighted
              return (
                <button
                  key={day.id}
                  onClick={() => scrollToDay(day.id)}
                  aria-current={isActive || undefined}
                  // ponytail: CSS cut keeps ~5 title chars; the full title lives in the day header
                  className={`shrink-0 max-w-[8rem] truncate rounded-full px-3.5 py-2 text-xs whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-white font-bold'
                      : 'bg-bg text-text-label font-semibold'
                  }`}
                >
                  {fmtChip(day.date, day.label)}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <InviteCard trip={trip} />
        {/* One DndContext for the whole trip: a card dragged out of one day
            can land in another, or in the wishlist. Always-measuring keeps an
            empty day droppable — its box only exists once the drag starts. */}
        <DndContext
          sensors={sensors}
          collisionDetection={cardsOverContainers(byDay)}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-6">
            {days.map((day) => (
              <DaySection
                key={day.id}
                day={day}
                tripId={trip.id}
                members={trip.members}
                events={byDay[day.id] ?? []}
                days={days}
              />
            ))}
          </div>

          <WishlistSection
            tripId={trip.id}
            days={days}
            members={trip.members}
            events={byDay[WISHLIST] ?? []}
          />
        </DndContext>
      </main>

      <TripNav
        active={isOngoing ? 'today' : 'itinerary'}
        todayDisabled={!isOngoing}
        onToday={scrollToNow}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <InstallPrompt />
    </div>
  )
}
