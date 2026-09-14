import { describe, it, expect } from 'vitest'
import { applyMove, cardsOverContainers, containerOf, sameOrder, type EventsByDay } from '../../lib/dnd'
import type { TripEvent } from '../../types'

const ev = (id: string): TripEvent => ({
  id, type: 'shared', title: id, time_start: '', time_end: '',
  location: '', notes: '', sort_order: 0,
})

const map = (): EventsByDay => ({
  d1: [ev('a'), ev('b')],
  d2: [ev('c')],
  d3: [],
  wishlist: [ev('w')],
})

const ids = (byDay: EventsByDay, key: string) => byDay[key].map((e) => e.id)

describe('containerOf', () => {
  it('finds the list holding a card', () => {
    expect(containerOf(map(), 'c')).toBe('d2')
  })

  it('answers a list key with itself, so an empty day can be dropped into', () => {
    expect(containerOf(map(), 'd3')).toBe('d3')
  })

  it('returns null for an id it has never seen', () => {
    expect(containerOf(map(), 'zzz')).toBeNull()
  })
})

describe('applyMove within one day', () => {
  it('reorders and leaves the other days alone', () => {
    const before = map()
    const moved = applyMove(before, 'b', 'a')!
    expect(ids(moved.byDay, 'd1')).toEqual(['b', 'a'])
    expect(moved.byDay.d2).toBe(before.d2)
    expect(moved.from).toBe('d1')
    expect(moved.to).toBe('d1')
  })

  it('reports nothing when the card is dropped on itself', () => {
    expect(applyMove(map(), 'a', 'a')).toBeNull()
  })

  it('reports nothing when either id is unknown', () => {
    expect(applyMove(map(), 'a', 'zzz')).toBeNull()
    expect(applyMove(map(), 'zzz', 'a')).toBeNull()
  })
})

describe('applyMove across days', () => {
  it('inserts at the position of the card it was dropped on', () => {
    const moved = applyMove(map(), 'a', 'c')!
    expect(ids(moved.byDay, 'd1')).toEqual(['b'])
    expect(ids(moved.byDay, 'd2')).toEqual(['a', 'c'])
    expect(moved.from).toBe('d1')
    expect(moved.to).toBe('d2')
  })

  it('appends when dropped on the day itself', () => {
    const moved = applyMove(map(), 'a', 'd2')!
    expect(ids(moved.byDay, 'd2')).toEqual(['c', 'a'])
  })

  it('moves into an empty day', () => {
    const moved = applyMove(map(), 'a', 'd3')!
    expect(ids(moved.byDay, 'd3')).toEqual(['a'])
    expect(ids(moved.byDay, 'd1')).toEqual(['b'])
  })

  it('moves a day card into the wishlist and back out', () => {
    const parked = applyMove(map(), 'a', 'wishlist')!
    expect(ids(parked.byDay, 'wishlist')).toEqual(['w', 'a'])

    const scheduled = applyMove(parked.byDay, 'a', 'd2')!
    expect(ids(scheduled.byDay, 'wishlist')).toEqual(['w'])
    expect(ids(scheduled.byDay, 'd2')).toEqual(['c', 'a'])
  })
})

describe('cardsOverContainers', () => {
  const rect = (top: number, height: number) =>
    ({ top, left: 0, width: 300, height, bottom: top + height, right: 300 })

  // d1 wraps cards a (0–72) and b (80–152); d3 is an empty day's drop hint.
  const rects = {
    d1: rect(0, 152), a: rect(0, 72), b: rect(80, 72),
    d3: rect(200, 50),
  }

  /** Which droppable a 72px-tall dragged card resolves to with its top at `top`. */
  const hit = (top: number) =>
    cardsOverContainers(map())({
      active: { id: 'a' },
      collisionRect: rect(top, 72),
      droppableRects: new Map(Object.entries(rects)),
      droppableContainers: Object.keys(rects).map((id) => ({ id })),
      pointerCoordinates: null,
    } as never)[0]?.id

  it('lands on the next card, not on the day box that shares its centre', () => {
    // Past the midpoint of a and b, but closest to d1's centre (76).
    expect(hit(45)).toBe('b')
  })

  it('still lets an empty day take the drop', () => {
    expect(hit(190)).toBe('d3')
  })
})

describe('sameOrder', () => {
  it('is true for the same ids in the same slots', () => {
    expect(sameOrder(map(), map())).toBe(true)
  })

  it('is false once a card has moved day', () => {
    expect(sameOrder(map(), applyMove(map(), 'a', 'd2')!.byDay)).toBe(false)
  })

  it('is false when a card was added or removed elsewhere', () => {
    const extra = { ...map(), d2: [ev('c'), ev('x')] }
    expect(sameOrder(map(), extra)).toBe(false)
  })

  it('treats a missing key and an empty list as the same thing', () => {
    const withoutD3 = map()
    delete withoutD3.d3
    expect(sameOrder(map(), withoutD3)).toBe(true)
  })
})
