import type { TripEvent, ForkItem, TripMember } from '../types'
import { mapsUrl } from '../lib/dates'
import { groupLabel, groupStyle } from '../lib/fork'
import { Icon } from './Icon'

interface Props {
  event: TripEvent
  /** Resolves each group's emails to names */
  members: TripMember[]
  /** This event's time runs over another in the same day. */
  clashes?: boolean
  onClick: (event: TripEvent) => void
}

export function ForkCard({ event, members, clashes = false, onClick }: Props) {
  const items: ForkItem[] = event.fork_items ?? []
  const time =
    event.time_start && event.time_end
      ? `${event.time_start}–${event.time_end}`
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
      className="w-full bg-white rounded-[12px] shadow-card border-l-[3px] border-l-primary text-left active:opacity-70 transition-opacity overflow-hidden"
    >
      <div className="pl-8 pr-4 pt-3 pb-2 flex items-center gap-1.5 text-primary">
        <Icon name="users" size={13} />
        <p className="text-[11.5px] font-semibold tracking-wide">
          分頭行動
          {time && <span className="font-mono tabular-nums">{` · ${time}`}</span>}
        </p>
        {/* Information, not a block: a half-planned day legitimately looks like this */}
        {clashes && <span className="text-[11.5px] font-semibold text-danger">時間重疊</span>}
      </div>
      <div data-testid="fork-groups" className="flex flex-col gap-2 pl-8 pr-3 pb-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`border-l-[3px] border rounded-[8px] p-2 ${groupStyle(i).card}`}
          >
            <span className={`inline-block text-[10px] font-bold mb-1 ${groupStyle(i).name}`}>
              {groupLabel(item, members)}
            </span>
            <p className="text-[13px] font-semibold text-text-strong">{item.title}</p>
            {item.location && (
              <p className="text-[11px] text-text-secondary mt-0.5 flex items-center gap-1.5">
                <span className="truncate">{item.location}</span>
                <a
                  href={mapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${item.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 -my-1.5 w-6 h-6 flex items-center justify-center text-primary"
                >
                  <Icon name="navigation" size={13} />
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
