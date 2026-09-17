import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '../hooks/useTrip'
import { fmtMD, groupByBand, todayStr, tripStatus } from '../lib/dates'
import { CATEGORY_IMAGE, resolveCategory } from '../lib/category'
import { groupFor, groupLabel } from '../lib/fork'
import { Icon } from '../components/Icon'
import { TripNav } from '../components/TripNav'
import { TripHeaderActions } from '../components/TripHeaderActions'
import { EventSheet } from '../components/EventSheet'
import { EventDetailSheet } from '../components/EventDetailSheet'
import type { TripEvent } from '../types'

interface Picked {
  event: TripEvent
  dayId: string
}

/**
 * A day column's content width (its cell adds px-1): a third of the scroller,
 * less a sliver so the fourth day peeks in and the row reads as scrollable.
 * Never under 7.5rem, the narrowest that still fits "09:20–12:50".
 */
const COLUMN_WIDTH = 'w-[max(7.5rem,calc((100cqw_-_0.75rem)/3_-_0.5rem))]'

/**
 * The whole trip on one screen: a column per day, and rows for 早 / 午 / 晚 so
 * the same meal lines up across days. A table because its rows already share
 * one height across every column — that is the alignment.
 */
export function OverviewPage() {
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay, loading } = useTrip(tripId ?? null)
  const [detail, setDetail] = useState<Picked | null>(null)
  const [editing, setEditing] = useState<Picked | null>(null)
  /** Email of the member whose group fork events show; '' is everyone. */
  const [person, setPerson] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = todayStr()

  /** Centres today's column, the way the timeline centres today's date chip. */
  useEffect(() => {
    const row = scrollRef.current
    const col = row?.querySelector<HTMLElement>('[aria-current]')
    if (!row || !col) return
    row.scrollLeft = col.offsetLeft - (row.clientWidth - col.clientWidth) / 2
  }, [loading, days.length])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-text-label">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  const toTimeline = () => navigate(`/trips/${trip.id}`)
  const bandsByDay = days.map((day) => groupByBand(eventsByDay[day.id] ?? []))
  const hasFork = days.some((day) => (eventsByDay[day.id] ?? []).some((event) => event.type === 'fork'))
  // A member who has since left the trip falls back to 全部
  const picked = trip.members.some((m) => m.email === person) ? person : ''
  const timeLine = (event: TripEvent) =>
    (event.time_start || event.time_end) && (
      // No spaces around the dash: a spaced range is wider than the column
      <span className="block text-[11px] font-mono tabular-nums text-text-label truncate">
        {[event.time_start, event.time_end].filter(Boolean).join('–')}
      </span>
    )
  /** A fork cell's body: the picked member's own activity, else every group as 組名:活動. */
  const forkBody = (event: TripEvent) => {
    const own = picked ? groupFor(event, picked, trip.members) : undefined
    if (own) {
      return <span className="text-[12px] font-semibold text-text-strong line-clamp-2 break-words">{own.title}</span>
    }
    return (event.fork_items ?? []).map((item, k) => (
      <span key={k} className="block text-[12px] text-text-strong truncate">
        <span className="text-text-secondary">{groupLabel(item, trip.members)}:</span>
        <span className="font-semibold">{item.title}</span>
      </span>
    ))
  }
  const filterChips = [
    { email: '', name: '全部' },
    ...trip.members.map((m) => ({ email: m.email, name: m.display_name || m.email })),
  ]

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-border sticky top-0 z-20">
        {/* Same title row as the timeline's, so switching tabs keeps the header still */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/')} className="text-primary shrink-0 -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="回旅程列表">
              <Icon name="chevronLeft" />
            </button>
            <h1 className="text-base font-bold text-text-strong truncate">{trip.name}</h1>
          </div>
          <TripHeaderActions trip={trip} />
        </div>
        {hasFork && (
          <div role="group" aria-label="看誰的行程" className="flex gap-1.5 px-4 pb-2.5 pt-1 overflow-x-auto [scrollbar-width:none]">
            {filterChips.map(({ email, name }) => (
              <button
                key={email}
                onClick={() => setPerson(email)}
                aria-pressed={email === picked}
                // Same pill as the timeline's date chips
                className={`shrink-0 max-w-[8rem] truncate rounded-full px-3.5 py-2 text-xs whitespace-nowrap ${
                  email === picked ? 'bg-primary text-white font-bold' : 'bg-bg text-text-label font-semibold'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 py-4">
        <div ref={scrollRef} className="@container overflow-x-auto px-3 [scrollbar-width:none]">
          <table className="border-collapse">
            <thead>
              <tr>
                {days.map((day) => {
                  const isToday = day.date === today
                  return (
                    <th
                      key={day.id}
                      scope="col"
                      aria-current={isToday ? 'date' : undefined}
                      className="px-1 pb-2 text-left align-bottom font-normal"
                    >
                      {/* Width lives on the content, not the cell: an auto-layout
                          table treats a cell width as a hint and lets the longest
                          nowrap title stretch the column. */}
                      <span className={`block ${COLUMN_WIDTH} rounded-[10px] px-2 py-1.5 ${isToday ? 'bg-primary text-white' : 'bg-white text-text-strong'}`}>
                        <span className="block text-[12px] font-extrabold whitespace-nowrap">{fmtMD(day.date)}</span>
                        {/* One titled day gives every header a title line, so the
                            date pills stay one height and the dates stay level. */}
                        {days.some((d) => d.label) && (
                          <span className={`block text-[11px] font-semibold truncate ${isToday ? 'text-white' : 'text-primary'}`}>
                            {day.label || '\u00a0'}
                          </span>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((band) => (
                <tr key={band}>
                  {days.map((day, i) => (
                    <td
                      key={day.id}
                      // 早 / 午 / 晚 unlabeled: a faint dashed rule is the only boundary
                      className={`px-1 py-2 align-top ${band ? 'border-t border-dashed border-icon-muted' : ''}`}
                    >
                      <div className={`flex flex-col gap-1 ${COLUMN_WIDTH}`}>
                        {bandsByDay[i][band].map((event) => event.type === 'fork' ? (
                          // Tinted with a leading bar like the timeline's fork card, so a split never passes for a white shared card
                          <button
                            key={event.id}
                            onClick={() => setDetail({ event, dayId: day.id })}
                            className="w-full bg-fork-bg-1 border-l-[3px] border-l-primary rounded-[8px] pl-1.5 pr-2 py-1.5 shadow-card text-left active:opacity-70 transition-opacity"
                          >
                            <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                              <Icon name="users" size={12} className="shrink-0" />
                              分頭行動
                            </span>
                            {forkBody(event)}
                            {timeLine(event)}
                          </button>
                        ) : (
                          <button
                            key={event.id}
                            onClick={() => setDetail({ event, dayId: day.id })}
                            className="w-full flex items-start gap-1.5 bg-white rounded-[8px] px-2 py-1.5 shadow-card text-left active:opacity-70 transition-opacity"
                          >
                            {/* mt-0.5 centres the 14px icon on the title's 18px line */}
                            <img
                              src={CATEGORY_IMAGE[resolveCategory(event)]}
                              alt=""
                              aria-hidden="true"
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              {/* No `block` here: it would override line-clamp's -webkit-box and undo the clamp */}
                              <span className="text-[12px] font-semibold text-text-strong line-clamp-2 break-words">
                                {event.title}
                              </span>
                              {timeLine(event)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <TripNav
        active="overview"
        todayDisabled={tripStatus(trip.start_date, trip.end_date) !== 'ongoing'}
        onToday={toTimeline}
        onTop={toTimeline}
        onOverview={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <EventDetailSheet
        open={!!detail}
        members={trip.members}
        event={detail?.event ?? null}
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
        events={editing ? eventsByDay[editing.dayId] ?? [] : []}
        members={trip.members}
        days={days}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
