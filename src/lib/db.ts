import { supabase } from '../supabase'
import { reportChannelStatus } from './realtime'
import { GUEST_PREFIX } from './members'
import type { Trip, TripMember, Day, TripEvent } from '../types'

// --- Helpers ---

type Debounced = { (): void; cancel: () => void }

/** Trailing debounce. One UPDATE touching N rows (reorder_events_rpc) arrives
 *  as N postgres_changes pushes; undebounced, each one triggers its own full
 *  refetch of the whole trip. */
function debounce(fn: () => void, ms = 50): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = (() => {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }) as Debounced
  run.cancel = () => clearTimeout(timer)
  return run
}

// --- Trip ---

/** The trip, the owner's membership and the days in one transaction (migration
 *  018): a half-created trip is one its own creator cannot read, or one with no
 *  days. The owner is whoever is calling, so no email is passed. */
export async function createTrip(
  name: string,
  ownerDisplayName: string,
  ownerAvatarUrl: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip_rpc', {
    p_name: name,
    p_start: startDate,
    p_end: endDate,
    p_display_name: ownerDisplayName,
    p_avatar_url: ownerAvatarUrl,
  })
  if (error || !data) throw new Error(error?.message ?? 'createTrip failed')
  return data as string
}

export async function joinTrip(tripId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('join_trip_rpc', { p_trip_id: tripId })
  if (error) console.error('[joinTrip] rpc failed:', error)
  return !error && data === true
}

export async function updateMyDisplayName(email: string, name: string): Promise<boolean> {
  // Two writes: trip_members is what other members see; auth metadata seeds
  // display_name when creating/joining future trips.
  const { error: memberError } = await supabase.from('trip_members')
    .update({ display_name: name })
    .eq('user_email', email)
  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: name } })
  return !memberError && !authError
}

export async function removeMember(tripId: string, email: string): Promise<boolean> {
  const { error, count } = await supabase.from('trip_members')
    .delete({ count: 'exact' })
    .eq('trip_id', tripId)
    .eq('user_email', email)
  return !error && (count ?? 0) > 0
}

/** Adds a companion with no account (a 長輩 without an email) by name; returns their member key, or null when refused. */
export async function addGuest(tripId: string, name: string): Promise<string | null> {
  const email = `${GUEST_PREFIX}${crypto.randomUUID()}`
  const { error } = await supabase.from('trip_members')
    .insert({ trip_id: tripId, user_email: email, display_name: name })
  return error ? null : email
}

/** Binds a companion added by name to the account they joined with: their fork groups follow the account and the guest row goes (migration 016). Cannot be undone. */
export async function mergeGuest(tripId: string, guest: string, member: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('merge_guest_rpc', { p_trip_id: tripId, p_guest: guest, p_member: member })
  return !error && data === true
}

export type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'owner_email'> & {
  members: TripMember[]
}

export async function listMyTrips(): Promise<TripSummary[]> {
  // RLS (trips_read) already restricts rows to trips the caller is a member of
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, owner_email, trip_members(user_email, display_name, avatar_url)')
  if (error) throw new Error(error.message)
  return (data ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    start_date: t.start_date as string,
    end_date: t.end_date as string,
    owner_email: (t.owner_email as string) ?? '',
    members: ((t.trip_members ?? []) as { user_email: string; display_name: string; avatar_url: string }[]).map(m => ({
      email: m.user_email,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
    })),
  }))
}

export interface TripPreview {
  name: string
  start_date: string
  end_date: string
  members: Pick<TripMember, 'display_name' | 'avatar_url'>[]
}

export async function getTripPreview(tripId: string): Promise<TripPreview | null> {
  const { data, error } = await supabase.rpc('trip_preview_rpc', { p_trip_id: tripId })
  if (error || !data) return null
  return data as TripPreview
}

export type WriteResult = { ok: boolean; error?: string }

export async function updateTrip(
  tripId: string,
  data: Partial<Pick<Trip, 'name' | 'start_date' | 'end_date' | 'notes'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('trips').update(data).eq('id', tripId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Copies a trip onto new dates and returns the new trip's id, or null when the
 * copy is refused (migration 020). Days, events, the wishlist, the fork groups
 * and the notes come across; members with accounts and images do not.
 */
export async function copyTrip(
  tripId: string,
  name: string,
  startDate: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('copy_trip_rpc', {
    p_trip_id: tripId,
    p_name: name,
    p_start: startDate,
  })
  if (error || !data) return null
  return data as string
}

// --- Read-only sharing (migration 021) ---

/** One fork group as the public page gets it: a heading, never emails. */
export interface PublicGroup {
  label: string
  title: string
  location: string
}

export interface PublicEvent {
  type: 'shared' | 'fork'
  title: string
  time_start: string
  time_end: string
  location: string
  notes: string
  groups: PublicGroup[]
}

/** The itinerary behind a share token. Deliberately the same range as
 *  `itineraryText`: no wishlist, no images, no event links, no member list. */
export interface PublicTrip {
  name: string
  start_date: string
  end_date: string
  notes: string
  days: { date: string; label: string; events: PublicEvent[] }[]
}

/** Turns the read-only link on (minting a fresh token, which also revokes any
 *  previous one) or off. Owner only, enforced in the RPC. */
export async function setTripShare(
  tripId: string,
  enabled: boolean
): Promise<{ ok: boolean; token?: string | null }> {
  const { data, error } = await supabase.rpc('set_trip_share_rpc', {
    p_trip_id: tripId,
    p_enabled: enabled,
  })
  if (error || !data) return { ok: false }

  const result = data as { ok?: boolean; token?: string | null }
  return result.ok ? { ok: true, token: result.token ?? null } : { ok: false }
}

/** Reads a shared itinerary. Works signed out — that is the whole point.
 *  null means the token is unknown, revoked, or the trip is gone. */
export async function getPublicTrip(token: string): Promise<PublicTrip | null> {
  if (!token) return null

  const { data, error } = await supabase.rpc('public_trip_rpc', { p_token: token })
  if (error || !data) return null
  return data as PublicTrip
}

export async function deleteTrip(tripId: string): Promise<boolean> {
  // ponytail: best-effort image cleanup; if it fails we accept orphaned
  // storage objects rather than blocking deletion (periodic cleanup later)
  try {
    const { data: files } = await supabase.storage.from('event-images').list(tripId)
    if (files?.length) {
      await supabase.storage.from('event-images').remove(files.map(f => `${tripId}/${f.name}`))
    }
  } catch { /* accept orphans */ }

  const { data, error } = await supabase.rpc('delete_trip_rpc', { p_trip_id: tripId })
  return !error && data === true
}

/** Adds and removes days to match the new range, then moves the trip's own
 *  dates — one transaction (migration 018). Refuses, naming the dates, when a
 *  day about to be removed still holds events: days cascade to their events. */
export async function updateTripDates(
  tripId: string,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; blockedDates?: string[]; error?: string }> {
  if (!startDate || !endDate || startDate > endDate) return { ok: false, error: 'INVALID_RANGE' }

  const { data, error } = await supabase.rpc('update_trip_dates_rpc', {
    p_trip_id: tripId,
    p_start: startDate,
    p_end: endDate,
  })
  if (error) return { ok: false, error: error.message }

  const result = (data ?? {}) as { ok?: boolean; blocked?: string[]; error?: string }
  if (result.ok) return { ok: true }
  if (result.blocked?.length) return { ok: false, blockedDates: result.blocked }
  return { ok: false, error: result.error ?? 'UPDATE_DATES_FAILED' }
}

// --- Days ---

export async function updateDayLabel(dayId: string, label: string): Promise<WriteResult> {
  const { error } = await supabase.from('days').update({ label }).eq('id', dayId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// --- Events ---

/** Bucket key for events not yet scheduled into a day (migration 013).
 *  Not a uuid, so it can never collide with a real day id. */
export const WISHLIST = 'wishlist'

/** `dayId` null puts the event in the trip's wishlist (migration 013). */
export async function createEvent(
  tripId: string,
  dayId: string | null,
  event: Omit<TripEvent, 'id'> & { id?: string }
): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...event, trip_id: tripId, day_id: dayId })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'createEvent failed')
  return data.id
}

export async function updateEvent(
  eventId: string,
  data: Partial<Omit<TripEvent, 'id'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('events').update(data).eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteEvent(eventId: string): Promise<WriteResult> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Move an event to another day, or to the wishlist (`dayId` null), appended
 *  at the end of the target list. The count query keeps sort_order unique
 *  without the caller having to know the target day's contents. */
export async function moveEvent(
  tripId: string,
  eventId: string,
  dayId: string | null
): Promise<WriteResult> {
  const query = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
  const { count, error: countError } = await (dayId
    ? query.eq('day_id', dayId)
    : query.is('day_id', null))
  if (countError) return { ok: false, error: countError.message }

  const { error } = await supabase
    .from('events')
    .update({ day_id: dayId, sort_order: count ?? 0 })
    .eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Copies a day's events onto another day of the same trip, appended after what
 * that day already holds.
 *
 * ponytail: one multi-row insert, so no RPC — a single statement is already
 * one transaction, and a half-copied day is not a state anyone can land in.
 *
 * Same trip, so nothing needs remapping: the fork groups' emails still name
 * members of this trip, and the image still lives in this trip's storage
 * folder, which only goes when the whole trip does.
 */
export async function copyEventsToDay(
  tripId: string,
  events: TripEvent[],
  toDayId: string,
  startOrder: number
): Promise<WriteResult> {
  if (!events.length) return { ok: true }

  const rows = events.map((event, i) => {
    // Drop the source id so each copy gets its own from the default
    const row: Record<string, unknown> = {
      ...event,
      trip_id: tripId,
      day_id: toDayId,
      sort_order: startOrder + i,
    }
    delete row.id
    return row
  })

  const { error } = await supabase.from('events').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function reorderEvents(dayId: string, orderedIds: string[]): Promise<WriteResult> {
  const { data, error } = await supabase.rpc('reorder_events_rpc', {
    p_day_id: dayId,
    p_ids: orderedIds,
  })
  if (error) return { ok: false, error: error.message }
  return data === true ? { ok: true } : { ok: false, error: 'REORDER_REJECTED' }
}

// --- Realtime ---

export interface TripDataHandlers {
  onTrip: (trip: Trip | null) => void
  onDays: (days: Day[]) => void
  onEvents: (byDay: Record<string, TripEvent[]>) => void
}

/**
 * Everything the timeline reads, over a single channel.
 *
 * ponytail: one channel with four filters instead of three channels — they
 * shared the one websocket anyway, and a per-table channel bought nothing
 * except three subscribe() statuses fighting over one indicator.
 *
 * Each table refetches its own slice, debounced: a reorder is one UPDATE over
 * N rows, which Postgres replicates as N separate change events.
 */
export function subscribeToTripData(tripId: string, handlers: TripDataHandlers): () => void {
  const fetchTrip = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_members(user_email, display_name, avatar_url)')
      .eq('id', tripId)
      .single()
    if (error || !data) { handlers.onTrip(null); return }
    handlers.onTrip({
      id: data.id,
      name: data.name,
      owner_email: data.owner_email ?? '',
      start_date: data.start_date,
      end_date: data.end_date,
      notes: data.notes ?? '',
      share_token: data.share_token ?? null,
      members: (data.trip_members as { user_email: string; display_name: string; avatar_url: string }[]).map(m => ({
        email: m.user_email,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
      })),
    })
  }

  const fetchDays = async () => {
    const { data } = await supabase
      .from('days')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order')
    handlers.onDays((data ?? []) as Day[])
  }

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order')

    const byDay: Record<string, TripEvent[]> = {}
    for (const row of (data ?? []) as (TripEvent & { day_id: string | null })[]) {
      (byDay[row.day_id ?? WISHLIST] ??= []).push(row)
    }
    handlers.onEvents(byDay)
  }

  fetchTrip()
  fetchDays()
  fetchEvents()

  const refetchTrip = debounce(fetchTrip)
  const refetchDays = debounce(fetchDays)
  const refetchEvents = debounce(fetchEvents)

  const channel = supabase
    .channel(`trip-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, refetchTrip)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` }, refetchTrip)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'days', filter: `trip_id=eq.${tripId}` }, refetchDays)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `trip_id=eq.${tripId}` }, refetchEvents)
    .subscribe(reportChannelStatus)

  return () => {
    refetchTrip.cancel()
    refetchDays.cancel()
    refetchEvents.cancel()
    supabase.removeChannel(channel)
  }
}

// Re-export TripMember so callers don't need to import from types directly
export type { TripMember }
