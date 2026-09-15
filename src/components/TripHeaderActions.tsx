import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { Icon } from './Icon'
import { SyncIndicator } from './SyncIndicator'
import { AvatarStack } from './AvatarStack'
import type { Trip } from '../types'

/** The trip header's right side — sync state, companions, settings gear —
 *  shared by every tab of a trip so settings stay one tap away. */
export function TripHeaderActions({ trip }: { trip: Trip }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const syncStatus = useSyncStatus()
  const toSettings = () => navigate(`/trips/${trip.id}/settings`)

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <SyncIndicator status={syncStatus} />
      <button onClick={toSettings} aria-label="旅伴" className="flex items-center">
        {trip.members.length > 0 ? (
          <AvatarStack members={trip.members} size={24} max={3} />
        ) : (
          user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          )
        )}
      </button>
      <button
        onClick={toSettings}
        aria-label="旅程設定"
        className="text-text-label w-8 h-8 flex items-center justify-center"
      >
        <Icon name="settings" />
      </button>
    </div>
  )
}
