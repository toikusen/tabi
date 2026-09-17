import type { Category } from './lib/category'

export interface ForkItem {
  /** Members in this group, by email so a rename keeps them in it */
  emails: string[]
  /** Also everyone named in no other group, companions without an account included */
  others: boolean
  title: string
  location: string
  notes: string
  /** Free-text name a group held before it had emails; read through groupEmails */
  person?: string
}

export interface TripEvent {
  id: string
  type: 'shared' | 'fork'
  title: string
  time_start: string
  time_end: string
  location: string
  notes: string
  sort_order: number
  fork_items?: ForkItem[]
  image_url?: string | null
  /** http(s) only (migration 014) */
  link_urls?: string[]
  /** Overrides the icon guessed from the title; null keeps the guess (migration 022) */
  category?: Category | null
}

export interface Day {
  id: string
  date: string       // 'YYYY-MM-DD'
  label: string
  sort_order: number
}

export interface TripMember {
  email: string
  display_name: string
  avatar_url: string
}

export interface Trip {
  id: string
  name: string
  owner_email: string
  members: TripMember[]
  start_date: string
  end_date: string
  /** Trip-level memo: flights, hotels, booking codes (migration 012) */
  notes: string
  /** Read-only share link token; null when sharing is off (migration 021) */
  share_token?: string | null
  /** Where the trip goes, as the geocoder named it; '' when never set (migration 023) */
  destination?: string
  /** Coordinates of `destination`, null until one is picked (migration 023) */
  lat?: number | null
  lon?: number | null
}
