import { useState } from 'react'
import type { TripEvent } from '../types'
import { mapsUrl } from '../lib/dates'
import { CATEGORY_IMAGE, eventCategory } from '../lib/category'
import { Icon } from './Icon'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function EventCard({ event, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const showThumbnail = !!event.image_url && !imgError
  const time =
    event.time_start && event.time_end
      ? `${event.time_start} – ${event.time_end}`
      : event.time_start || event.time_end

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(event)
        }
      }}
      className="w-full bg-white rounded-[12px] py-3 pl-8 pr-3 shadow-card text-left active:opacity-70 transition-opacity"
    >
      <div className="flex items-start gap-2.5">
        {/* The row's visual anchor. Guessed from the title, so it is decorative
            only — the title right next to it always carries the real meaning. */}
        <span className="mt-0.5 shrink-0 w-8 h-8 rounded-[9px] bg-bg flex items-center justify-center">
          <img
            src={CATEGORY_IMAGE[eventCategory(event.title)]}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-[18px] h-[18px]"
          />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-text-strong truncate">{event.title}</p>
          {time && (
            <p className="text-[11px] font-mono tabular-nums text-text-label mt-0.5">{time}</p>
          )}
          {event.location && (
            <p className="text-[11.5px] text-text-secondary mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{event.location}</span>
              <a
                href={mapsUrl(event.location)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`導航到 ${event.location}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 -my-1.5 w-7 h-7 flex items-center justify-center text-primary"
              >
                <Icon name="navigation" size={14} />
              </a>
            </p>
          )}
          {event.notes && (
            <p className="text-[11.5px] text-text-label mt-2 pl-2 border-l-2 border-l-note-accent leading-relaxed whitespace-pre-line">
              {event.notes}
            </p>
          )}
        </div>

        {showThumbnail && (
          <img
            src={event.image_url!}
            alt={event.title}
            loading="lazy"
            decoding="async"
            // 4:3 keeps a landscape photo recognisable; a square crop cut off
            // half the subject.
            className="shrink-0 w-16 h-12 rounded-[8px] object-cover bg-surface-subtle"
            onError={() => setImgError(true)}
          />
        )}
      </div>
    </div>
  )
}
