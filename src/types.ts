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
  link_url?: string | null
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
}
