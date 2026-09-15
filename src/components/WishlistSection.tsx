import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { WISHLIST } from '../lib/db'
import { SortableCard } from './SortableCard'
import type { TripEvent, TripMember } from '../types'

interface Props {
  members: TripMember[]
  events: TripEvent[]
  /** Opens the page's event sheet; null is a blank one. */
  onOpen: (event: TripEvent | null) => void
}

/**
 * Places collected before they have a date. Same event rows as the timeline,
 * just with no day attached (migration 013) — so a card is scheduled either by
 * dragging it onto a day or by picking a date in the edit sheet.
 *
 * ponytail: a native <details>, closed by default — which means dragging in or
 * out only works while it is open. Opening it is one tap, and the date picker
 * covers the closed case.
 */
export function WishlistSection({ members, events, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: WISHLIST })

  return (
    <details
      className={`mt-6 bg-white border rounded-[12px] px-4 py-3 ${
        isOver ? 'border-primary' : 'border-border'
      }`}
    >
      <summary className="text-[13px] font-extrabold text-text-strong cursor-pointer marker:text-text-label">
        想去清單
        {events.length > 0 && (
          <span className="ml-1.5 text-xs font-semibold text-text-label">{events.length}</span>
        )}
      </summary>

      <SortableContext id={WISHLIST} items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 mt-3">
          {events.map((event) => (
            <SortableCard key={event.id} event={event} members={members} onOpen={onOpen} />
          ))}

          {events.length === 0 && (
            <p className="text-xs text-text-label">還沒排進哪一天的地方,先丟這裡。</p>
          )}

          <button
            onClick={() => onOpen(null)}
            className="w-full border border-dashed border-icon-muted rounded-[8px] py-2.5 text-xs font-semibold text-primary"
          >
            ＋ 新增想去的地方
          </button>
        </div>
      </SortableContext>
    </details>
  )
}
