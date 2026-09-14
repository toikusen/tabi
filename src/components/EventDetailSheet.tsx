import { useState, useEffect } from 'react'
import type { TripEvent } from '../types'
import { BottomSheet } from './BottomSheet'
import { mapsUrl } from '../lib/dates'

interface Props {
  open: boolean
  event: TripEvent | null
  onClose: () => void
  onEdit: (event: TripEvent) => void
  hideEdit?: boolean
}

export function EventDetailSheet({ open, event, onClose, onEdit, hideEdit }: Props) {
  const [zoom, setZoom] = useState(false)
  const [imgError, setImgError] = useState(false)
  // The sheet stays mounted between openings, so reset per subject.
  useEffect(() => {
    setZoom(false)
    setImgError(false)
  }, [event?.id, open])

  if (!open || !event) return null

  const isFork = event.type === 'fork'
  // A fork event carries no title of its own, so labels fall back to its name.
  const displayTitle = isFork ? '分頭行動' : event.title
  const showImage = !!event.image_url && !imgError

  return (
    <>
    <BottomSheet
      label="行程詳情"
      onClose={onClose}
      backdropTestId="detail-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] overflow-hidden max-h-[85vh] flex flex-col"
    >
        <div className="w-9 h-1 bg-border rounded-full mx-auto mt-3 mb-0 shrink-0" />

        {showImage && (
          // Fixed ratio reserves the space before the image lands, so the sheet
          // no longer jumps; tap opens the uncropped view.
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={`放大檢視 ${displayTitle}`}
            className="w-full shrink-0 aspect-[4/3] max-h-[38vh] bg-surface-subtle"
          >
            <img
              src={event.image_url!}
              alt={displayTitle}
              decoding="async"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </button>
        )}

        <div className="px-4 pt-3 pb-6 flex flex-col gap-3 overflow-y-auto">
          <div>
            <p className="text-[15px] font-bold text-text-strong">
              {displayTitle}
            </p>
            {(event.time_start || event.time_end) && (
              <p className="text-xs text-text-label mt-0.5">
                {event.time_start && event.time_end
                  ? `${event.time_start} – ${event.time_end}`
                  : event.time_start || event.time_end}
              </p>
            )}
            {event.location && (
              <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{event.location}</span>
                <a
                  href={mapsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${event.location}`}
                  className="text-primary font-semibold"
                >
                  導航
                </a>
              </p>
            )}
          </div>

          {isFork && (
            <div className="flex flex-col gap-2">
              {(event.fork_items ?? []).map((item, i) => (
                <div key={i} className="bg-surface-subtle border border-border rounded-[8px] p-3">
                  <p className="text-[11px] font-bold text-primary mb-1">{item.person}</p>
                  <p className="text-sm font-semibold text-text-strong">{item.title}</p>
                  {item.location && (
                    <p className="text-xs text-text-secondary mt-0.5">{item.location}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-text-label mt-1 whitespace-pre-line">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {event.notes && (
            <p className="text-xs text-text-label leading-relaxed whitespace-pre-line bg-surface-subtle rounded-[8px] p-3">
              {event.notes}
            </p>
          )}

          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full bg-bg text-primary rounded-[10px] py-2.5 text-sm font-semibold"
            >
              前往官網
            </a>
          )}

          {!hideEdit && (
            <button
              onClick={() => onEdit(event)}
              className="w-full border border-border text-text-strong rounded-[10px] py-2.5 text-sm font-semibold"
            >
              編輯行程
            </button>
          )}
        </div>
    </BottomSheet>

    {zoom && (
      <div
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setZoom(false)
        }}
      >
        <button
          type="button"
          autoFocus
          aria-label="關閉大圖"
          className="absolute inset-0 w-full h-full cursor-default"
          onClick={() => setZoom(false)}
        />
        <img
          src={event.image_url!}
          alt={displayTitle}
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
      </div>
    )}
    </>
  )
}
