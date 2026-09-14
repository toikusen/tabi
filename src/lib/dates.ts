import type { Day, TripEvent } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function parse(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

/** '2026-10-12' → '10/12 (一)' */
export function fmtMD(dateStr: string): string {
  const d = parse(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`
}

/** '2026-10-12' → '10/12 一'; with a day title, '10/12 飛行日' (date chips) */
export function fmtChip(dateStr: string, label = ''): string {
  const d = parse(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${label || WEEKDAYS[d.getDay()]}`
}

/** Date range; year shown only when it disambiguates:
 *  current year:  '10/12 (一) – 10/15 (四)'
 *  other year:    '2027/10/12 (一) – 10/15 (四)'
 *  cross-year:    '12/30 (三) – 2027/1/2 (六)' */
export function fmtRange(start: string, end: string, today = todayStr()): string {
  const startYear = start.slice(0, 4)
  const endYear = end.slice(0, 4)
  const s = (startYear !== today.slice(0, 4) ? startYear + '/' : '') + fmtMD(start)
  const e = (endYear !== startYear ? endYear + '/' : '') + fmtMD(end)
  return `${s} – ${e}`
}

/** Local today as 'YYYY-MM-DD' */
export function todayStr(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Inclusive day count of a trip */
export function dayCount(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) + 1
}

export function daysUntil(start: string, today = todayStr()): number {
  return Math.round((parse(start).getTime() - parse(today).getTime()) / 86400000)
}

export type TripStatus = 'upcoming' | 'ongoing' | 'ended'

export function tripStatus(start: string, end: string, today = todayStr()): TripStatus {
  if (today < start) return 'upcoming'
  if (today > end) return 'ended'
  return 'ongoing'
}

/** Date → 'HH:MM' */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Group trips by status, each group ordered the way a traveller reads it:
 *  ongoing and upcoming soonest-first, ended most-recent-first. */
export function sortTrips<T extends { start_date: string; end_date: string }>(
  trips: T[],
  today = todayStr()
): { ongoing: T[]; upcoming: T[]; ended: T[] } {
  const ongoing: T[] = []
  const upcoming: T[] = []
  const ended: T[] = []

  for (const trip of trips) {
    const bucket = { ongoing, upcoming, ended }[tripStatus(trip.start_date, trip.end_date, today)]
    bucket.push(trip)
  }

  ongoing.sort((a, b) => a.start_date.localeCompare(b.start_date))
  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date))
  ended.sort((a, b) => b.end_date.localeCompare(a.end_date))

  return { ongoing, upcoming, ended }
}

/** Google Maps search link for a free-text place name. */
export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

/** Where to insert the "now" line in a list ordered by sort_order, not time.
 *  Answers: one past the last event that has already started. */
export function nowLineIndex(events: { time_start: string }[], now: string): number {
  let index = 0
  events.forEach((e, i) => {
    if (e.time_start && e.time_start <= now) index = i + 1
  })
  return index
}

/** The event to bring into view on open: the first one today that has not ended.
 *  Falls back to today's first event; null when today is outside the trip. */
export function scrollTargetEventId({ days, eventsByDay, now }: {
  days: Day[]
  eventsByDay: Record<string, TripEvent[]>
  now: Date
}): string | null {
  const today = todayStr(now)
  const day = days.find(d => d.date === today)
  if (!day) return null

  const byTime = [...(eventsByDay[day.id] ?? [])]
    .filter(e => e.time_start)
    .sort((a, b) => a.time_start.localeCompare(b.time_start))
  if (!byTime.length) return null

  const time = hhmm(now)
  const live = byTime.find(e => (e.time_end || e.time_start) > time)
  return (live ?? byTime[0]).id
}

// Google Maps URL API caps a route at 9 intermediate waypoints.
const MAX_WAYPOINTS = 9

/** Google Maps multi-stop route through a day's places, in list order.
 *  null when there is nothing to route (fewer than two places). */
export function dayRouteUrl(locations: string[]): string | null {
  const stops = locations.map(s => s.trim()).filter(Boolean)
  if (stops.length < 2) return null

  const params = new URLSearchParams({
    api: '1',
    origin: stops[0],
    destination: stops[stops.length - 1],
  })
  // ponytail: past the cap we drop the extra middle stops Google would
  // reject anyway — the route still starts and ends in the right place.
  const waypoints = stops.slice(1, -1).slice(0, MAX_WAYPOINTS)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))

  return `https://www.google.com/maps/dir/?${params}`
}
