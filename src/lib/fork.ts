import type { ForkItem, TripEvent, TripMember } from '../types'

/**
 * A fork group's heading: its members' current names in trip order, then 其他人
 * when it also takes everyone named in no other group.
 */
export function groupLabel(item: ForkItem, members: TripMember[]): string {
  // A client still on a build from before emails writes groups without them
  const emails = item.emails ?? []
  const names = members.filter((m) => emails.includes(m.email)).map((m) => m.display_name || m.email)
  return [...names, ...(item.others ? ['其他人'] : [])].join('、')
}

/** The group a member follows in a fork event: the one naming them, else the 其他人 one. */
export function groupFor(event: TripEvent, email: string): ForkItem | undefined {
  const items = event.fork_items ?? []
  return items.find((item) => (item.emails ?? []).includes(email)) ?? items.find((item) => item.others)
}
