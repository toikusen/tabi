import type { ForkItem, TripEvent, TripMember } from '../types'

/**
 * A fork group's member emails. A group saved before groups had emails names one
 * person as free text instead, matched here to the member going by that name.
 */
export function groupEmails(item: ForkItem, members: TripMember[]): string[] {
  if (item.emails) return item.emails
  return members.filter((m) => (m.display_name || m.email) === item.person).map((m) => m.email)
}

/**
 * A fork group's heading: its members' current names in trip order, then 其他人
 * when it also takes everyone named in no other group.
 */
export function groupLabel(item: ForkItem, members: TripMember[]): string {
  const emails = groupEmails(item, members)
  const names = members.filter((m) => emails.includes(m.email)).map((m) => m.display_name || m.email)
  const label = [...names, ...(item.others ? ['其他人'] : [])].join('、')
  // An old free-text name matching nobody (同事), or a group a removal or a bind left empty
  return label || item.person || '未指定'
}

/** The group a member follows in a fork event: the one naming them, else the 其他人 one. */
export function groupFor(event: TripEvent, email: string, members: TripMember[]): ForkItem | undefined {
  const items = event.fork_items ?? []
  return items.find((item) => groupEmails(item, members).includes(email)) ?? items.find((item) => item.others)
}
