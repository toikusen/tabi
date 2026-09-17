import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { updateDayLabel } from '../lib/db'
import { toast } from '../lib/toast'
import { fmtMD, todayStr, hhmm, nowLineIndex, dayRouteUrl, overlappingIds } from '../lib/dates'
import { Icon } from './Icon'
import { SortableCard } from './SortableCard'
import { weatherEmoji, type DayWeather } from '../lib/weather'
import type { Day, TripEvent, TripMember } from '../types'

function NowLine({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="now-line">
      <span className="shrink-0 w-2 h-2 rounded-full bg-danger" />
      <span className="h-0.5 flex-1 bg-danger rounded-full" />
      <span className="shrink-0 text-[10.5px] font-bold text-danger">現在 {time}</span>
    </div>
  )
}

interface Props {
  day: Day
  members: TripMember[]
  events: TripEvent[]
  /** Ticks once a minute, owned by the page: one timer for the whole trip
   *  instead of one per day. */
  now: Date
  /** Set only for days inside the forecast window of a trip with a destination. */
  weather?: DayWeather
  /** Opens the page's sheets. They live there, not here, so a ten-day trip
   *  mounts one of each rather than ten. */
  onCreate: (dayId: string) => void
  onOpen: (event: TripEvent, dayId: string) => void
  /** Set only when the trip has another day to copy onto. */
  onCopyDay?: (dayId: string) => void
}

/** One day of the timeline. A drop target for the trip's DndContext, which
 *  lives in TimelinePage so a card can cross between days. */
export function DaySection({ day, members, events, now, weather, onCreate, onOpen, onCopyDay }: Props) {
  const [editingLabel, setEditingLabel] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: day.id })

  const isToday = day.date === todayStr(now)
  const nowTime = hhmm(now)
  const nowIndex = isToday ? nowLineIndex(events, nowTime) : -1
  const routeUrl = dayRouteUrl(events.map((e) => e.location))
  const clashing = overlappingIds(events)

  /** The title input is uncontrolled and mounts fresh on every edit, so it
   *  always starts from the live label — a tripmate's rename that arrived
   *  meanwhile is never written back over. */
  const saveLabel = async (value: string) => {
    setEditingLabel(false)
    const label = value.trim()
    if (label === day.label) return
    const result = await updateDayLabel(day.id, label)
    if (!result.ok) toast('標籤儲存失敗,請再試一次')
  }

  return (
    <section id={`day-${day.id}`} style={{ scrollMarginTop: 104 }}>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-extrabold text-text-strong whitespace-nowrap">{fmtMD(day.date)}</span>
        {weather && (
          <span
            className="shrink-0 text-[11px] text-text-label whitespace-nowrap tabular-nums"
            aria-label={`天氣 最高 ${weather.max} 度 最低 ${weather.min} 度`}
          >
            {weatherEmoji(weather.code)} {weather.max}°/{weather.min}°
          </span>
        )}
        {editingLabel ? (
          <input
            autoFocus
            aria-label="日期標籤"
            placeholder="例:飛行日、新宿、購物日"
            maxLength={12}
            className="text-[13px] font-bold text-primary bg-transparent border-b border-primary outline-none flex-1 min-w-0 placeholder:font-normal placeholder:text-text-label"
            defaultValue={day.label}
            onBlur={(e) => saveLabel(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.currentTarget.value = day.label
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
            }}
          />
        ) : day.label ? (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-[13px] font-bold text-primary min-w-0 truncate py-2 -my-2"
          >
            {day.label}
          </button>
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="shrink-0 flex items-center gap-0.5 text-xs text-text-label py-2 -my-2"
          >
            <Icon name="plus" size={12} />
            當天主題
          </button>
        )}
        <div className="h-px flex-1 bg-border shrink-0" />
        {/* 一天的地點串成一條 Google Maps 路線,省下逐點導航 */}
        {routeUrl && (
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${fmtMD(day.date)} 當日路線`}
            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary bg-bg-accent rounded-full px-2.5 py-2 -my-1"
          >
            <Icon name="navigation" size={12} />
            路線
          </a>
        )}
        {/* Nothing to copy from an empty day, and nowhere to put it in a one-day trip */}
        {onCopyDay && events.length > 0 && (
          <button
            onClick={() => onCopyDay(day.id)}
            aria-label={`複製 ${fmtMD(day.date)} 的行程`}
            className="w-11 h-11 -my-2 flex items-center justify-center shrink-0"
          >
            <span className="w-8 h-8 rounded-[10px] bg-bg text-text-label flex items-center justify-center">
              <Icon name="copy" size={14} />
            </span>
          </button>
        )}
        <button
          onClick={() => onCreate(day.id)}
          aria-label="新增行程"
          className="w-11 h-11 -my-2 -mr-1.5 flex items-center justify-center shrink-0"
        >
          <span className="w-8 h-8 rounded-[10px] bg-bg-accent text-primary flex items-center justify-center">
            <Icon name="plus" size={16} />
          </span>
        </button>
      </div>

      <SortableContext id={day.id} items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2">
          {events.map((event, i) => (
            <span key={event.id} className="contents">
              {i === nowIndex && <NowLine time={nowTime} />}
              <SortableCard
                event={event}
                members={members}
                clashes={clashing.has(event.id)}
                onOpen={(e) => onOpen(e, day.id)}
              />
            </span>
          ))}
          {nowIndex === events.length && events.length > 0 && <NowLine time={nowTime} />}
          {/* An empty day needs a body to be a drop target at all, and the
              hint is what tells you dragging here is a thing. */}
          {events.length === 0 && (
            <p
              className={`rounded-[12px] border border-dashed py-4 text-center text-xs ${
                isOver ? 'border-primary bg-bg-accent text-primary' : 'border-icon-muted text-text-label'
              }`}
            >
              還沒安排,把卡片拖來這裡
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  )
}
