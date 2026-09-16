import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EventCard } from './EventCard'
import { ForkCard } from './ForkCard'
import type { TripEvent, TripMember } from '../types'

/** A timeline card with its drag grip. Draggable from any list — a day, or the
 *  wishlist — since the trip's single DndContext owns all of them. */
export function SortableCard({
  event,
  members,
  clashes = false,
  onOpen,
}: {
  event: TripEvent
  members: TripMember[]
  /** This event's time runs over another in the same day. */
  clashes?: boolean
  onOpen: (e: TripEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      id={`event-${event.id}`}
      style={style}
      className="relative"
    >
      {/* 拖曳把手：立即可拖，卡片本體維持點擊 */}
      <span
        {...attributes}
        {...listeners}
        role="button"
        aria-label="拖曳排序"
        // ponytail: the grip is centred on the card's first icon, whose y differs
        // per card type — event icon sits at 30px (py-3 + mt-0.5 + h-8/2),
        // the fork header icon at ~21px (pt-3 + 17px row/2). Grip is h-7, so pt = y - 14.
        className={`absolute left-0 top-0 bottom-0 w-8 z-10 flex items-start justify-center touch-none cursor-grab active:cursor-grabbing ${
          event.type === 'fork' ? 'pt-[7px]' : 'pt-4'
        }`}
      >
        <span className="w-5 h-7 rounded-[5px] bg-bg flex items-center justify-center text-muted">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" />
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" />
            <circle cx="3" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" />
          </svg>
        </span>
      </span>
      {event.type === 'fork' ? (
        <ForkCard event={event} members={members} clashes={clashes} onClick={onOpen} />
      ) : (
        <EventCard event={event} clashes={clashes} onClick={onOpen} />
      )}
    </div>
  )
}
