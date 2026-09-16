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
  updateTripDates,
  removeMember,
  updateMyDisplayName,
  subscribeToTripData,
  addGuest,
  mergeGuest,
  copyEventsToDay,
  copyTrip,
  getPublicTrip,
  setTripShare,
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
  it('creates the trip, the membership and the days in one RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'new-trip-id', error: null })

    const id = await createTrip('沖繩 2025', 'Sei', 'https://avatar.url', '2025-06-11', '2025-06-12')

    expect(id).toBe('new-trip-id')
    expect(mockRpc).toHaveBeenCalledWith('create_trip_rpc', {
      p_name: '沖繩 2025',
      p_start: '2025-06-11',
      p_end: '2025-06-12',
      p_display_name: 'Sei',
      p_avatar_url: 'https://avatar.url',
    })
    // No partial trip left behind by a direct insert that half-succeeded
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws instead of returning a trip id the server never made', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rls' } })
    await expect(createTrip('沖繩', 'Sei', '', '2025-06-11', '2025-06-12')).rejects.toThrow('rls')

    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(createTrip('沖繩', 'Sei', '', '2025-06-11', '2025-06-12')).rejects.toThrow()
  })
})

describe('setTripShare', () => {
  it('mints a token when sharing is turned on', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, token: 'tok-1' }, error: null })

    expect(await setTripShare('t1', true)).toEqual({ ok: true, token: 'tok-1' })
    expect(mockRpc).toHaveBeenCalledWith('set_trip_share_rpc', { p_trip_id: 't1', p_enabled: true })
  })

  it('clears the token when sharing is turned off', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, token: null }, error: null })
    expect(await setTripShare('t1', false)).toEqual({ ok: true, token: null })
  })

  it('reports a refusal rather than pretending the link changed', async () => {
    mockRpc.mockResolvedValue({ data: { ok: false }, error: null })
    expect(await setTripShare('t1', true)).toEqual({ ok: false })

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await setTripShare('t1', true)).toEqual({ ok: false })
  })
})

describe('getPublicTrip', () => {
  const payload = {
    name: '沖繩', start_date: '2031-02-01', end_date: '2031-02-02', notes: 'BR116',
    days: [{ date: '2031-02-01', label: '飛行日', events: [] }],
  }

  it('reads an itinerary by its share token', async () => {
    mockRpc.mockResolvedValue({ data: payload, error: null })

    expect(await getPublicTrip('tok-1')).toEqual(payload)
    expect(mockRpc).toHaveBeenCalledWith('public_trip_rpc', { p_token: 'tok-1' })
  })

  it('returns null for a revoked or unknown token', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    expect(await getPublicTrip('gone')).toBeNull()

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getPublicTrip('gone')).toBeNull()
  })

  it('never asks the server about an empty token', async () => {
    expect(await getPublicTrip('')).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('copyTrip', () => {
  it('hands the whole copy to one RPC and returns the new trip id', async () => {
    mockRpc.mockResolvedValue({ data: 'copy-id', error: null })

    expect(await copyTrip('t1', '2027 沖繩', '2027-05-01')).toBe('copy-id')
    expect(mockRpc).toHaveBeenCalledWith('copy_trip_rpc', {
      p_trip_id: 't1',
      p_name: '2027 沖繩',
      p_start: '2027-05-01',
    })
    // Nothing is built client-side, so a failure cannot leave half a trip
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns null when the copy is refused, rather than a trip id that is not there', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rls' } })
    expect(await copyTrip('t1', 'x', '2027-05-01')).toBeNull()

    mockRpc.mockResolvedValue({ data: null, error: null })
    expect(await copyTrip('t1', 'x', '2027-05-01')).toBeNull()
  })
})

describe('copyEventsToDay', () => {
  const ev = (id: string, title: string, sort_order: number) => ({
    id, type: 'shared' as const, title, time_start: '08:00', time_end: '09:00',
    location: '那霸', notes: 'memo', sort_order,
  })

  it('inserts copies in one statement, appended after what the target day holds', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })

    const result = await copyEventsToDay('t1', [ev('e1', '早餐', 0), ev('e2', '水族館', 1)], 'd2', 3)

    expect(result).toEqual({ ok: true })
    expect(mockFrom).toHaveBeenCalledWith('events')
    // One call, one statement: a partial copy is not a state the day can land in
    expect(insert).toHaveBeenCalledOnce()
    const [rows] = insert.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ trip_id: 't1', day_id: 'd2', title: '早餐', location: '那霸', notes: 'memo', sort_order: 3 })
    expect(rows[1]).toMatchObject({ day_id: 'd2', title: '水族館', sort_order: 4 })
  })

  it('never carries the source ids over, so the copies get their own', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })

    await copyEventsToDay('t1', [ev('e1', '早餐', 0)], 'd2', 0)

    const [rows] = insert.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows[0].id).toBeUndefined()
  })

  it('carries the fork groups and links across unchanged', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })
    const fork = {
      ...ev('e1', '', 0),
      type: 'fork' as const,
      fork_items: [{ emails: ['a@test.com'], others: false, title: '看海', location: '', notes: '' }],
      link_urls: ['https://example.com'],
      image_url: 'https://img/t1/e1.jpg',
    }

    await copyEventsToDay('t1', [fork], 'd2', 0)

    const [rows] = insert.mock.calls[0] as [Record<string, unknown>[]]
    // Same trip, so the group emails still resolve and the image still belongs to this trip's folder
    expect(rows[0]).toMatchObject({
      type: 'fork',
      fork_items: fork.fork_items,
      link_urls: ['https://example.com'],
      image_url: 'https://img/t1/e1.jpg',
    })
  })

  it('does not go to the database for an empty day', async () => {
    expect(await copyEventsToDay('t1', [], 'd2', 0)).toEqual({ ok: true })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('reports a refused insert instead of claiming the day was copied', async () => {
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'rls' } }) })
    expect(await copyEventsToDay('t1', [ev('e1', '早餐', 0)], 'd2', 0)).toEqual({ ok: false, error: 'rls' })
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

describe('updateTripDates', () => {
  it('hands the whole date change to one RPC', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-02')

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith('update_trip_dates_rpc', {
      p_trip_id: 't1',
      p_start: '2026-08-01',
      p_end: '2026-08-02',
    })
    // The check and the delete share the RPC's transaction, so nothing is
    // read here and then written from a second request
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('names the days that still have events when the range is refused', async () => {
    mockRpc.mockResolvedValue({ data: { ok: false, blocked: ['2026-08-02'] }, error: null })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result).toEqual({ ok: false, blockedDates: ['2026-08-02'] })
  })

  it('returns INVALID_RANGE without calling the RPC when start > end', async () => {
    const result = await updateTripDates('t1', '2026-08-02', '2026-08-01')

    expect(result).toEqual({ ok: false, error: 'INVALID_RANGE' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('reports a failed RPC rather than a silent success', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await updateTripDates('t1', '2026-08-01', '2026-08-02')).toEqual({ ok: false, error: 'boom' })

    mockRpc.mockResolvedValue({ data: { ok: false, error: 'INVALID_RANGE' }, error: null })
    expect(await updateTripDates('t1', '2026-08-01', '2026-08-02')).toEqual({ ok: false, error: 'INVALID_RANGE' })

    // A null body is a refusal too, not an ok
    mockRpc.mockResolvedValue({ data: null, error: null })
    expect(await updateTripDates('t1', '2026-08-01', '2026-08-02')).toEqual({ ok: false, error: 'UPDATE_DATES_FAILED' })
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
