import { useInviteLink } from '../hooks/useInviteLink'
import { isGuest } from '../lib/members'
import type { Trip } from '../types'

/** Shown while a trip still has exactly one member. No dismiss state needed:
 *  the card's reason to exist disappears the moment someone joins. */
export function InviteCard({ trip }: { trip: Trip }) {
  const { share } = useInviteLink(trip)

  // A companion added by name cannot open a link, so they do not count as having joined
  if (trip.members.filter((m) => !isGuest(m.email)).length > 1) return null

  return (
    <div className="bg-bg-accent rounded-[12px] px-4 py-3 mb-4 flex items-center gap-3">
      <p className="flex-1 text-xs text-text-strong">把連結傳給旅伴,一起排行程</p>
      <button
        onClick={share}
        className="shrink-0 bg-primary text-white text-xs font-semibold rounded-[8px] px-3 py-2 active:opacity-80"
      >
        分享邀請連結
      </button>
    </div>
  )
}
