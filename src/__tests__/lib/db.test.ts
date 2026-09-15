// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockChannel, mockRpc, mockStorageFrom, mockUpdateUser } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockChannel = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  }))
  const mockRpc = vi.fn()
  const mockStorageFrom = vi.fn()
  const mockUpdateUser = vi.fn()
  return { mockFrom, mockChannel, mockRpc, mockStorageFrom, mockUpdateUser }
})

vi.mock('../../supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
    auth: { updateUser: mockUpdateUser },
  },
}))

import {
  createTrip,
  joinTrip,
  createEvent,
  reorderEvents,
  listMyTrips,
  deleteTrip,
  updateTrip,
  updateDayLabel,
  updateEvent,
  deleteEvent,
  dateRange,
  updateTripDates,
  removeMember,
  updateMyDisplayName,
  subscribeToTripData,
  addGuest,
  mergeGuest,
} from '../../lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mergeGuest', () => {
  it('asks the merge RPC to bind the guest to the member', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    expect(await mergeGuest('t1', 'guest:dad', 'dad@test.com')).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('merge_guest_rpc', { p_trip_id: 't1', p_guest: 'guest:dad', p_member: 'dad@test.com' })
  })

  it('reports a refused or failed merge as false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    expect(await mergeGuest('t1', 'guest:dad', 'dad@test.com')).toBe(false)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await mergeGuest('t1', 'guest:dad', 'dad@test.com')).toBe(false)
  })
})

describe('addGuest', () => {
  it('adds a member keyed guest:<uuid>, with no @ to pass for a login, and returns the key', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })

    const key = await addGuest('t1', '爸爸')

    expect(key).toMatch(/^guest:[0-9a-f-]{36}$/)
    expect(mockFrom).toHaveBeenCalledWith('trip_members')
    expect(insert).toHaveBeenCalledWith({ trip_id: 't1', user_email: key, display_name: '爸爸' })
  })

  it('returns null when the insert is refused', async () => {
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'rls' } }) })
    expect(await addGuest('t1', '爸爸')).toBeNull()
  })
})

describe('createTrip', () => {
  it('inserts into trips, trip_members, and days; returns a UUID', async () => {
    const tripsInsert = vi.fn().mockResolvedValue({ error: null })
    const dayInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return { insert: tripsInsert }
      if (table === 'trip_members') return { insert: memberInsert }
      if (table === 'days') return { insert: dayInsert }
      return {}
    })

    const id = await createTrip('沖繩 2025', 'sei@test.com', 'Sei', 'https://avatar.url', '2025-06-11', '2025-06-12')

    // Returns a client-generated UUID (not predictable, just verify format)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(tripsInsert).toHaveBeenCalledWith(expect.objectContaining({ name: '沖繩 2025', owner_email: 'sei@test.com' }))
    expect(memberInsert).toHaveBeenCalledWith({
      trip_id: id,
      user_email: 'sei@test.com',
      display_name: 'Sei',
      avatar_url: 'https://avatar.url',
    })

    const [daysArg] = dayInsert.mock.calls[0] as [Array<{ date: string }>]
    expect(daysArg.length).toBe(2)
    expect(daysArg[0].date).toBe('2025-06-11')
    expect(daysArg[1].date).toBe('2025-06-12')
  })
})

describe('joinTrip', () => {
  it('returns true when join_trip_rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await joinTrip('trip-id')
    expect(mockRpc).toHaveBeenCalledWith('join_trip_rpc', { p_trip_id: 'trip-id' })
    expect(result).toBe(true)
  })

  it('returns false when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await joinTrip('bad-trip-id')
    expect(result).toBe(false)
  })

  it('returns false when the rpc reports failure (trip not found)', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await joinTrip('missing-trip')
    expect(result).toBe(false)
  })
})

describe('updateMyDisplayName', () => {
  const memberUpdate = (error: unknown = null) => {
    const eq = vi.fn().mockResolvedValue({ error })
    const update = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ update })
    return { update, eq }
  }

  it('updates all own trip_members rows and auth metadata', async () => {
    const { update, eq } = memberUpdate()
    mockUpdateUser.mockResolvedValue({ error: null })

    const ok = await updateMyDisplayName('sei@test.com', '小安')

    expect(ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('trip_members')
    expect(update).toHaveBeenCalledWith({ display_name: '小安' })
    expect(eq).toHaveBeenCalledWith('user_email', 'sei@test.com')
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: '小安' } })
  })

  it('returns false when the member update fails', async () => {
    memberUpdate({ message: 'rls' })
    mockUpdateUser.mockResolvedValue({ error: null })

    expect(await updateMyDisplayName('sei@test.com', '小安')).toBe(false)
  })

  it('returns false when the auth metadata update fails', async () => {
    memberUpdate()
    mockUpdateUser.mockResolvedValue({ error: { message: 'boom' } })

    expect(await updateMyDisplayName('sei@test.com', '小安')).toBe(false)
  })
})

describe('createEvent', () => {
  it('calls from("events").insert() and returns the new id', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'event-id' }, error: null }),
        }),
      }),
    })

    const id = await createEvent('trip-id', 'day-id', {
      type: 'shared',
      title: '美麗海水族館',
      time_start: '12:00',
      time_end: '15:00',
      location: '本部町',
      notes: '',
      sort_order: 0,
    })

    expect(mockFrom).toHaveBeenCalledWith('events')
    expect(id).toBe('event-id')
  })
})

describe('reorderEvents', () => {
  it('sends a single rpc call instead of one update per event', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await reorderEvents('d1', ['e2', 'e1'])
    expect(mockRpc).toHaveBeenCalledOnce()
    expect(mockRpc).toHaveBeenCalledWith('reorder_events_rpc', { p_day_id: 'd1', p_ids: ['e2', 'e1'] })
    expect(result).toEqual({ ok: true })
  })

  it('reports failure when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'denied' } })
    expect(await reorderEvents('d1', ['e1'])).toEqual({ ok: false, error: 'denied' })
  })

  it('reports failure when the rpc returns false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    expect(await reorderEvents('d1', ['e1'])).toEqual({ ok: false, error: 'REORDER_REJECTED' })
  })
})

describe('listMyTrips', () => {
  it('selects trips without a server-side order (ordering is client-side)', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: 't1', name: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-05', owner_email: 'sei@test.com' }],
      error: null,
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const trips = await listMyTrips()

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockSelect).toHaveBeenCalledWith('id, name, start_date, end_date, owner_email, trip_members(user_email, display_name, avatar_url)')
    expect(trips).toHaveLength(1)
    expect(trips[0].id).toBe('t1')
  })
})

describe('updateTrip', () => {
  it('updates the given fields on the trip row', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await updateTrip('t1', { name: '新名字' })

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockUpdate).toHaveBeenCalledWith({ name: '新名字' })
    expect(mockEq).toHaveBeenCalledWith('id', 't1')
  })
})

describe('deleteTrip', () => {
  it('removes trip images then calls delete_trip_rpc', async () => {
    const mockList = vi.fn().mockResolvedValue({ data: [{ name: 'a.jpg' }, { name: 'b.png' }], error: null })
    const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null })
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove })
    mockRpc.mockResolvedValue({ data: true, error: null })

    const ok = await deleteTrip('t1')

    expect(mockStorageFrom).toHaveBeenCalledWith('event-images')
    expect(mockList).toHaveBeenCalledWith('t1')
    expect(mockRemove).toHaveBeenCalledWith(['t1/a.jpg', 't1/b.png'])
    expect(mockRpc).toHaveBeenCalledWith('delete_trip_rpc', { p_trip_id: 't1' })
    expect(ok).toBe(true)
  })

  it('still deletes the trip when storage cleanup throws', async () => {
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockRejectedValue(new Error('storage down')),
      remove: vi.fn(),
    })
    mockRpc.mockResolvedValue({ data: true, error: null })

    const ok = await deleteTrip('t1')

    expect(ok).toBe(true)
  })

  it('still deletes the trip when remove() throws after a successful list', async () => {
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [{ name: 'a.jpg' }], error: null }),
      remove: vi.fn().mockRejectedValue(new Error('remove failed')),
    })
    mockRpc.mockResolvedValue({ data: true, error: null })

    const ok = await deleteTrip('t1')

    expect(ok).toBe(true)
  })

  it('returns false when rpc denies (not owner)', async () => {
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn(),
    })
    mockRpc.mockResolvedValue({ data: false, error: null })

    const ok = await deleteTrip('t1')

    expect(ok).toBe(false)
  })
})

describe('removeMember', () => {
  it('returns true when a row was deleted', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
      }),
    })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const ok = await removeMember('t1', 'a@test.com')

    expect(ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('trip_members')
    expect(mockDelete).toHaveBeenCalledWith({ count: 'exact' })
  })

  it('returns false when RLS blocks the delete (0 rows affected)', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 0 }),
      }),
    })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const ok = await removeMember('t1', 'a@test.com')

    expect(ok).toBe(false)
  })
})

describe('dateRange', () => {
  it('returns inclusive date list', () => {
    expect(dateRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ])
  })

  it('returns single date when start equals end', () => {
    expect(dateRange('2026-08-30', '2026-08-30')).toEqual(['2026-08-30'])
  })
})

describe('updateTripDates', () => {
  function setupDaysMock(opts: {
    existingDays: { id: string; date: string }[]
    eventsOnDayIds?: string[]
    fetchError?: { message: string }
    deleteError?: { message: string }
  }) {
    const daysSelectEq = vi.fn().mockResolvedValue(
      opts.fetchError ? { data: null, error: opts.fetchError } : { data: opts.existingDays, error: null }
    )
    const eventsSelectIn = vi.fn().mockResolvedValue({
      data: (opts.eventsOnDayIds ?? []).map(day_id => ({ day_id })),
      error: null,
    })
    const daysDeleteIn = vi.fn().mockResolvedValue(
      opts.deleteError ? { error: opts.deleteError } : { error: null }
    )
    const daysInsert = vi.fn().mockResolvedValue({ error: null })
    const daysUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const tripsUpdateEq = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'days') return {
        select: vi.fn().mockReturnValue({ eq: daysSelectEq }),
        delete: vi.fn().mockReturnValue({ in: daysDeleteIn }),
        insert: daysInsert,
        update: vi.fn().mockReturnValue({ eq: daysUpdateEq }),
      }
      if (table === 'events') return {
        select: vi.fn().mockReturnValue({ in: eventsSelectIn }),
      }
      if (table === 'trips') return {
        update: vi.fn().mockReturnValue({ eq: tripsUpdateEq }),
      }
      return {}
    })

    return { daysDeleteIn, daysInsert, tripsUpdateEq }
  }

  it('extends the range by inserting missing days', async () => {
    const { daysInsert, tripsUpdateEq } = setupDaysMock({
      existingDays: [{ id: 'd1', date: '2026-08-01' }],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-02')

    expect(result.ok).toBe(true)
    expect(daysInsert).toHaveBeenCalledWith([
      { trip_id: 't1', date: '2026-08-02', label: '', sort_order: 1 },
    ])
    expect(tripsUpdateEq).toHaveBeenCalledWith('id', 't1')
  })

  it('shrinks the range by deleting empty out-of-range days', async () => {
    const { daysDeleteIn } = setupDaysMock({
      existingDays: [
        { id: 'd1', date: '2026-08-01' },
        { id: 'd2', date: '2026-08-02' },
      ],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result.ok).toBe(true)
    expect(daysDeleteIn).toHaveBeenCalledWith('id', ['d2'])
  })

  it('refuses to shrink when a removed day still has events', async () => {
    const { daysDeleteIn, tripsUpdateEq } = setupDaysMock({
      existingDays: [
        { id: 'd1', date: '2026-08-01' },
        { id: 'd2', date: '2026-08-02' },
      ],
      eventsOnDayIds: ['d2'],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result.ok).toBe(false)
    expect(result.blockedDates).toEqual(['2026-08-02'])
    expect(daysDeleteIn).not.toHaveBeenCalled()
    expect(tripsUpdateEq).not.toHaveBeenCalled()
  })

  it('returns INVALID_RANGE without touching the db when start > end', async () => {
    const result = await updateTripDates('t1', '2026-08-02', '2026-08-01')

    expect(result).toEqual({ ok: false, error: 'INVALID_RANGE' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns ok:false when the initial days fetch errors', async () => {
    const { daysInsert, daysDeleteIn, tripsUpdateEq } = setupDaysMock({
      existingDays: [],
      fetchError: { message: 'boom' },
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-02')

    expect(result).toEqual({ ok: false, error: 'boom' })
    expect(daysInsert).not.toHaveBeenCalled()
    expect(daysDeleteIn).not.toHaveBeenCalled()
    expect(tripsUpdateEq).not.toHaveBeenCalled()
  })

  it('returns ok:false and stops when the delete errors', async () => {
    const { daysInsert, tripsUpdateEq } = setupDaysMock({
      existingDays: [
        { id: 'd1', date: '2026-08-01' },
        { id: 'd2', date: '2026-08-02' },
      ],
      deleteError: { message: 'nope' },
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result).toEqual({ ok: false, error: 'nope' })
    expect(daysInsert).not.toHaveBeenCalled()
    expect(tripsUpdateEq).not.toHaveBeenCalled()
  })
})

describe('write results', () => {
  it('updateTrip reports failure instead of swallowing the error', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'nope' } })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateTrip('t1', { name: 'x' })).toEqual({ ok: false, error: 'nope' })
  })

  it('updateTrip reports success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateTrip('t1', { name: 'x' })).toEqual({ ok: true })
  })

  it('updateDayLabel takes only dayId and reports failure', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const update = vi.fn(() => ({ eq }))
    mockFrom.mockReturnValue({ update })
    expect(await updateDayLabel('d1', 'Day 1')).toEqual({ ok: false, error: 'boom' })
    expect(update).toHaveBeenCalledWith({ label: 'Day 1' })
    expect(eq).toHaveBeenCalledWith('id', 'd1')
  })

  it('updateEvent takes only eventId and reports success', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: vi.fn(() => ({ eq })) })
    expect(await updateEvent('e1', { title: 'x' })).toEqual({ ok: true })
  })

  it('deleteEvent takes only eventId and reports failure', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'denied' } })
    mockFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })
    expect(await deleteEvent('e1')).toEqual({ ok: false, error: 'denied' })
  })
})

describe('subscribeToTripData', () => {
  const noop = { onTrip: () => {}, onDays: () => {}, onEvents: () => {} }

  /** Wires up the three fetch shapes and captures the channel's own handlers,
   *  so a realtime push can be replayed without a websocket. */
  function setup(eventRows: unknown[] = []) {
    const eventsOrder = vi.fn().mockResolvedValue({ data: eventRows })
    const daysOrder = vi.fn().mockResolvedValue({ data: [] })
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not a member' } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return { select: () => ({ eq: () => ({ single }) }) }
      if (table === 'days') return { select: () => ({ eq: () => ({ order: daysOrder }) }) }
      if (table === 'events') return { select: () => ({ eq: () => ({ order: eventsOrder }) }) }
      return {}
    })

    const pushes: Record<string, () => void> = {}
    mockChannel.mockImplementation(() => {
      const channel = {
        on: (_event: string, config: { table: string }, handler: () => void) => {
          pushes[config.table] = handler
          return channel
        },
        subscribe: vi.fn(() => channel),
      }
      return channel
    })

    return { pushes, eventsOrder, daysOrder, single }
  }

  const settle = () => new Promise((r) => setTimeout(r, 120))

  it('groups every event of the trip by day', async () => {
    setup([
      { id: 'e1', day_id: 'd1', title: 'A', sort_order: 0 },
      { id: 'e2', day_id: 'd2', title: 'B', sort_order: 0 },
      { id: 'e3', day_id: 'd1', title: 'C', sort_order: 1 },
    ])

    const received: Record<string, unknown[]>[] = []
    subscribeToTripData('t1', { ...noop, onEvents: (byDay) => received.push(byDay) })
    await vi.waitFor(() => expect(received).toHaveLength(1))

    expect(Object.keys(received[0]).sort()).toEqual(['d1', 'd2'])
    expect(received[0].d1).toHaveLength(2)
    expect(received[0].d2).toHaveLength(1)
  })

  it('puts events with no day in the wishlist bucket', async () => {
    setup([{ id: 'e1', day_id: null, title: 'A', sort_order: 0 }])

    const received: Record<string, unknown[]>[] = []
    subscribeToTripData('t1', { ...noop, onEvents: (byDay) => received.push(byDay) })
    await vi.waitFor(() => expect(received).toHaveLength(1))

    expect(received[0].wishlist).toHaveLength(1)
  })

  it('opens one channel for the whole trip, not one per table', () => {
    setup()
    mockChannel.mockClear()
    subscribeToTripData('t1', noop)
    expect(mockChannel).toHaveBeenCalledOnce()
  })

  // This is the point of debouncing: reorder_events_rpc is a single UPDATE
  // over N rows, which Postgres replicates as N separate change events.
  it('coalesces a burst of pushes into one refetch', async () => {
    const { pushes, eventsOrder } = setup()
    const unsubscribe = subscribeToTripData('t1', noop)
    await vi.waitFor(() => expect(eventsOrder).toHaveBeenCalledTimes(1))

    for (let i = 0; i < 5; i++) pushes.events()
    await settle()

    expect(eventsOrder).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('refetches only the table that changed', async () => {
    const { pushes, eventsOrder, daysOrder } = setup()
    const unsubscribe = subscribeToTripData('t1', noop)
    await vi.waitFor(() => expect(eventsOrder).toHaveBeenCalledTimes(1))

    pushes.events()
    await settle()

    expect(eventsOrder).toHaveBeenCalledTimes(2)
    expect(daysOrder).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('drops a pending refetch when the caller unsubscribes', async () => {
    const { pushes, eventsOrder } = setup()
    const unsubscribe = subscribeToTripData('t1', noop)
    await vi.waitFor(() => expect(eventsOrder).toHaveBeenCalledTimes(1))

    pushes.events()
    unsubscribe()
    await settle()

    expect(eventsOrder).toHaveBeenCalledTimes(1)
  })
})
