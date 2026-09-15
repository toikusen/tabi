import type { Day, Trip, TripEvent, TripMember } from '../types'
import { fmtMD, fmtRange } from './dates'
import { groupLabel } from './fork'
import { toast } from './toast'

function timeLabel(event: TripEvent): string {
  if (event.time_start && event.time_end) return `${event.time_start}–${event.time_end}`
  return event.time_start || event.time_end || ''
}

function eventLines(event: TripEvent, members: TripMember[]): string[] {
  const time = timeLabel(event)
  const head = time ? `${time} ` : ''

  if (event.type === 'fork') {
    return [
      `${head}分頭行動`,
      ...(event.fork_items ?? []).map(
        item => `  ・${groupLabel(item, members)}:${item.title}${item.location ? `(${item.location})` : ''}`
      ),
    ]
  }

  const lines = [`${head}${event.title}`]
  if (event.location) lines.push(`  地點:${event.location}`)
  if (event.notes) lines.push(...event.notes.split('\n').map(l => `  ${l}`))
  return lines
}

/** Plain-text itinerary, for people who are not in the trip (LINE, mail, 長輩). */
export function itineraryText(
  trip: Pick<Trip, 'name' | 'start_date' | 'end_date' | 'notes' | 'members'>,
  days: Day[],
  eventsByDay: Record<string, TripEvent[]>
): string {
  const lines = [trip.name, fmtRange(trip.start_date, trip.end_date)]

  if (trip.notes?.trim()) lines.push('', '【重要資訊】', trip.notes.trim())

  for (const day of days) {
    lines.push('', `── ${fmtMD(day.date)}${day.label ? ` ${day.label}` : ''}`)
    const events = eventsByDay[day.id] ?? []
    if (!events.length) {
      lines.push('(尚未安排)')
      continue
    }
    for (const event of events) lines.push(...eventLines(event, trip.members))
  }

  return lines.join('\n')
}

/** Native share sheet where the browser has one, clipboard everywhere else. */
export async function shareItinerary(title: string, text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return
    } catch (error) {
      // User dismissed the sheet — not a failure, and nothing to fall back to.
      if ((error as Error)?.name === 'AbortError') return
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    toast('行程已複製')
  } catch {
    toast('複製失敗,請再試一次')
  }
}
