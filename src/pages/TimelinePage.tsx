import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, KeyboardSensor, MeasuringStrategy,
  useSensor, useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useTrip } from '../hooks/useTrip'
import { fmtChip, scrollTargetEventId, todayStr, tripStatus } from '../lib/dates'
import { Icon } from '../components/Icon'
import { TripHeaderActions } from '../components/TripHeaderActions'
import { TripNav } from '../components/TripNav'
import { DaySection } from '../components/DaySection'
import { WishlistSection } from '../components/WishlistSection'
import { WISHLIST } from '../lib/db'
import { useTripDnd } from '../hooks/useTripDnd'
import { cardsOverContainers, type EventsByDay } from '../lib/dnd'
import { InstallPrompt } from '../components/InstallPrompt'
import { InviteCard } from '../components/InviteCard'
import { DayCopySheet } from '../components/DayCopySheet'
import { EventSheet } from '../components/EventSheet'
import { EventDetailSheet } from '../components/EventDetailSheet'
import { useNow } from '../hooks/useNow'
import { useWeather } from '../hooks/useWeather'
import { copyEventsToDay } from '../lib/db'
import { toast } from '../lib/toast'
import type { Day, TripEvent } from '../types'

/** An event and the list it was opened from; a null dayId is the wishlist. */
interface Picked {
  event: TripEvent | null
  dayId: string | null
}

export function TimelinePage() {
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay, loading } = useTrip(tripId ?? null)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  /** One sheet each for the whole trip, not one per day: a ten-day trip used
   *  to mount eleven of each, and a minute timer per day besides. */
  const [detail, setDetail] = useState<Picked | null>(null)
  const [editing, setEditing] = useState<Picked | null>(null)
  /** The day whose events are being copied onto another day. */
  const [copyingDay, setCopyingDay] = useState<Day | null>(null)
  const now = useNow()
  const weather = useWeather(trip)

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
          <TripHeaderActions trip={trip} />
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
                members={trip.members}
                events={byDay[day.id] ?? []}
                now={now}
                weather={weather[day.date]}
                onCreate={(dayId) => setEditing({ event: null, dayId })}
                onOpen={(event, dayId) => setDetail({ event, dayId })}
                onCopyDay={days.length > 1 ? () => setCopyingDay(day) : undefined}
              />
            ))}
          </div>

          {/* A wish opens straight into the edit sheet: giving it a date is
              the whole point of tapping one. */}
          <WishlistSection
            members={trip.members}
            events={byDay[WISHLIST] ?? []}
            onOpen={(event) => setEditing({ event, dayId: null })}
          />
        </DndContext>
      </main>

      <TripNav
        active={isOngoing ? 'today' : 'itinerary'}
        todayDisabled={!isOngoing}
        onToday={scrollToNow}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onOverview={() => navigate(`/trips/${trip.id}/overview`)}
      />

      <EventDetailSheet
        open={!!detail}
        event={detail?.event ?? null}
        members={trip.members}
        onClose={() => setDetail(null)}
        onEdit={() => {
          setEditing(detail)
          setDetail(null)
        }}
      />

      <EventSheet
        open={!!editing}
        event={editing?.event ?? null}
        dayId={editing?.dayId ?? null}
        tripId={trip.id}
        events={editing ? byDay[editing.dayId ?? WISHLIST] ?? [] : []}
        members={trip.members}
        days={days}
        onClose={() => setEditing(null)}
      />

      {copyingDay && (
        <DayCopySheet
          from={copyingDay}
          days={days}
          count={(byDay[copyingDay.id] ?? []).length}
          onClose={() => setCopyingDay(null)}
          onPick={async (toDayId) => {
            const source = byDay[copyingDay.id] ?? []
            setCopyingDay(null)
            const result = await copyEventsToDay(
              trip.id,
              source,
              toDayId,
              (byDay[toDayId] ?? []).length
            )
            if (!result.ok) toast('複製失敗,請再試一次')
          }}
        />
      )}

      <InstallPrompt />
    </div>
  )
}
