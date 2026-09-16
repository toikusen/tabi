import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicTrip, type PublicEvent, type PublicTrip } from '../lib/db'
import { fmtMD, fmtRange, mapsUrl } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'

/** Everything here is a size up from the rest of the app (which sits at
 *  11–15px): the reader this page exists for is the 長輩 who never installed
 *  it, often on a phone held at arm's length. */
function TimeAndPlace({ event }: { event: PublicEvent }) {
  const time = [event.time_start, event.time_end].filter(Boolean).join(' – ')
  if (!time && !event.location) return null

  return (
    <p className="text-[14px] text-text-secondary mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
      {time && <span className="font-mono tabular-nums">{time}</span>}
      {event.location && (
        <a
          href={mapsUrl(event.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
        >
          {event.location}
          <Icon name="navigation" size={13} />
        </a>
      )}
    </p>
  )
}

function EventBlock({ event }: { event: PublicEvent }) {
  if (event.type === 'fork') {
    return (
      <li className="bg-white rounded-[12px] border-l-[4px] border-l-primary border border-border px-4 py-3">
        <p className="text-[13px] font-bold text-primary flex items-center gap-1.5">
          <Icon name="users" size={14} />
          分頭行動
        </p>
        <TimeAndPlace event={event} />
        <ul className="mt-2 flex flex-col gap-2">
          {event.groups.map((group, i) => (
            <li key={i} className="bg-surface-subtle rounded-[8px] px-3 py-2">
              <span className="text-[13px] font-bold text-text-secondary">{group.label}</span>
              <p className="text-[16px] font-semibold text-text-strong">{group.title}</p>
              {group.location && (
                <a
                  href={mapsUrl(group.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-primary inline-flex items-center gap-1 underline underline-offset-2 mt-0.5"
                >
                  {group.location}
                  <Icon name="navigation" size={13} />
                </a>
              )}
            </li>
          ))}
        </ul>
      </li>
    )
  }

  return (
    <li className="bg-white rounded-[12px] border border-border px-4 py-3">
      <p className="text-[16px] font-semibold text-text-strong">{event.title}</p>
      <TimeAndPlace event={event} />
      {event.notes && (
        <p className="text-[14px] text-text-label mt-2 pl-2 border-l-2 border-l-note-accent leading-relaxed whitespace-pre-line">
          {event.notes}
        </p>
      )}
    </li>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 text-center">
      <p className="text-[15px] text-text-label leading-relaxed">{children}</p>
    </div>
  )
}

/**
 * The itinerary as someone without an account sees it: read-only, no
 * navigation, nothing to tap but the map links.
 *
 * It replaces a plain-text copy pasted into LINE, whose whole problem was
 * going stale the moment the plan changed. So this fetches on every open and
 * has no cache of its own.
 */
export function PublicTripPage() {
  const { token } = useParams<{ token: string }>()
  const [trip, setTrip] = useState<PublicTrip | null | 'loading'>('loading')

  useEffect(() => {
    let live = true
    getPublicTrip(token ?? '').then((t) => {
      if (live) setTrip(t)
    })
    return () => { live = false }
  }, [token])

  if (trip === 'loading') return <Centered>載入行程中...</Centered>

  // Revoked, mistyped, or the trip is gone — no difference worth explaining
  if (!trip) return <Centered>這個連結已失效,請跟旅程的主揪要新的連結。</Centered>

  return (
    <div className="min-h-screen bg-bg max-w-lg mx-auto px-4 py-6">
      <header className="flex items-center gap-2 mb-1">
        <Logo size={22} />
        <span className="text-[13px] font-bold text-text-label">Tabi</span>
      </header>

      <h1 className="text-[22px] font-bold text-text-strong leading-snug">{trip.name}</h1>
      <p className="text-[15px] text-text-label mt-1">{fmtRange(trip.start_date, trip.end_date)}</p>

      {trip.notes.trim() && (
        <section className="bg-white rounded-[12px] border border-border px-4 py-3 mt-4">
          <p className="text-[13px] font-bold text-text-label">重要資訊</p>
          <p className="text-[15px] text-text-strong mt-1.5 leading-relaxed whitespace-pre-line">
            {trip.notes.trim()}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-6 mt-6">
        {trip.days.map((day) => (
          <section key={day.date}>
            <h2 className="text-[17px] font-extrabold text-text-strong mb-2">
              {fmtMD(day.date)}
              {day.label && <span className="text-primary ml-2">{day.label}</span>}
            </h2>
            {day.events.length === 0 ? (
              <p className="text-[14px] text-text-label">還沒安排</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {day.events.map((event, i) => (
                  <EventBlock key={i} event={event} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="text-[12px] text-text-label text-center mt-8">
        這是唯讀的行程,內容會跟著主揪的修改更新。
      </p>
    </div>
  )
}
