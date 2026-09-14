import { closestCenter, type CollisionDetection } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { TripEvent } from '../types'

/** Every drop target on the timeline, keyed by day id (plus `WISHLIST`). */
export type EventsByDay = Record<string, TripEvent[]>

/**
 * Which list an id belongs to. A list key answers itself: the containers are
 * droppables too, so a day with no cards can still receive one.
 * Day ids are uuids and never collide with event ids or with `WISHLIST`.
 */
export function containerOf(byDay: EventsByDay, id: string): string | null {
  if (id in byDay) return id
  return Object.keys(byDay).find((key) => byDay[key].some((e) => e.id === id)) ?? null
}

/**
 * closestCenter, minus every list that has cards. A day's box wraps its cards,
 * so its centre sits among theirs and swallows the drop meant for the card
 * beside it — and a drop on its own box is a no-op, so the card never moves.
 * An empty day (or wishlist) keeps its box: it has nothing else to hit.
 */
export const cardsOverContainers =
  (byDay: EventsByDay): CollisionDetection =>
  (args) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => !byDay[String(c.id)]?.length),
    })

export interface Move {
  byDay: EventsByDay
  from: string
  to: string
}

/**
 * Move `activeId` to where `overId` sits, within one day or across two.
 * `overId` may be a card (insert at its index) or a container (append).
 * Returns null when nothing would change.
 */
export function applyMove(byDay: EventsByDay, activeId: string, overId: string): Move | null {
  const from = containerOf(byDay, activeId)
  const to = containerOf(byDay, overId)
  if (!from || !to) return null

  if (from === to) {
    const list = byDay[from]
    const oldIndex = list.findIndex((e) => e.id === activeId)
    const newIndex = list.findIndex((e) => e.id === overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null
    return { byDay: { ...byDay, [from]: arrayMove(list, oldIndex, newIndex) }, from, to }
  }

  const source = byDay[from]
  const moving = source.find((e) => e.id === activeId)
  if (!moving) return null

  const target = byDay[to]
  const overIndex = target.findIndex((e) => e.id === overId)
  const at = overIndex < 0 ? target.length : overIndex

  return {
    byDay: {
      ...byDay,
      [from]: source.filter((e) => e.id !== activeId),
      [to]: [...target.slice(0, at), moving, ...target.slice(at)],
    },
    from,
    to,
  }
}

/** Do two maps hold the same ids in the same order? Tells the optimistic copy
 *  that the server has caught up and can be dropped. */
export function sameOrder(a: EventsByDay, b: EventsByDay): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key] ?? []
    const y = b[key] ?? []
    if (x.length !== y.length) return false
    if (x.some((e, i) => e.id !== y[i].id)) return false
  }
  return true
}
