import { useState } from 'react'
import { addGuest, mergeGuest, removeMember } from '../lib/db'
import { isGuest } from '../lib/members'
import { toast } from '../lib/toast'
import { Icon } from './Icon'
import { ConfirmSheet } from './ConfirmSheet'
import { useInviteLink } from '../hooks/useInviteLink'
import type { Trip } from '../types'

interface Props {
  trip: Trip
  currentEmail?: string
}

export function MembersSection({ trip, currentEmail }: Props) {
  const { copied, share: handleShare, copy: handleCopy } = useInviteLink(trip)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const [guestName, setGuestName] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)
  /** The companion whose account picker is open */
  const [binding, setBinding] = useState<string | null>(null)
  /** The pick awaiting confirmation, since binding cannot be undone */
  const [bindPick, setBindPick] = useState<{ guest: Trip['members'][number]; account: Trip['members'][number] } | null>(null)

  const isOwner = trip.owner_email === currentEmail
  const accounts = trip.members.filter((m) => !isGuest(m.email))

  const handleBind = async () => {
    if (!bindPick) return
    const { guest, account } = bindPick
    setBindPick(null)
    setBinding(null)
    if (!(await mergeGuest(trip.id, guest.email, account.email))) toast('綁定失敗,請再試一次')
  }

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = guestName.trim()
    if (!name) return
    setAddingGuest(true)
    const key = await addGuest(trip.id, name)
    setAddingGuest(false)
    if (!key) {
      toast('新增失敗,請再試一次')
      return
    }
    setGuestName('')
  }

  const handleRemove = async (email: string) => {
    if (confirming !== email) {
      setConfirming(email)
      return
    }
    setConfirming(null)
    setRemoving(email)
    const ok = await removeMember(trip.id, email)
    setRemoving(null)
    if (!ok) toast('移除失敗,請再試一次')
  }

  return (
    <section className="bg-white rounded-[12px] p-4 border border-border">
      <p className="text-xs font-semibold text-text-label mb-3">旅伴 ({trip.members.length})</p>
      <div className="flex flex-col gap-3 mb-3">
        {trip.members.map((member) => (
          <div key={member.email}>
            <div className="flex items-center gap-3">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-text-secondary">
                    {(member.display_name || member.email).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-strong truncate">
                  {member.display_name || member.email}
                </p>
                {isGuest(member.email) ? (
                  <p className="text-[11px] text-text-label">未加入</p>
                ) : member.display_name && (
                  <p className="text-[11px] text-text-label truncate">{member.email}</p>
                )}
                {trip.owner_email === member.email && (
                  <p className="text-[10px] text-primary font-semibold">主揪</p>
                )}
              </div>
              {isGuest(member.email) && (
                <button
                  onClick={() => setBinding(binding === member.email ? null : member.email)}
                  aria-expanded={binding === member.email}
                  className="text-xs font-semibold shrink-0 px-2 py-1 rounded-[6px] text-primary"
                >
                  綁定
                </button>
              )}
              {/* A companion without an account is anyone's to remove; a real member only the owner's */}
              {(isGuest(member.email) || (isOwner && member.email !== currentEmail)) && (
                <button
                  onClick={() => handleRemove(member.email)}
                  disabled={removing === member.email}
                  className={`text-xs font-semibold shrink-0 disabled:opacity-40 px-2 py-1 rounded-[6px] ${
                    confirming === member.email
                      ? 'text-white bg-danger'
                      : 'text-text-label'
                  }`}
                >
                  {removing === member.email ? '移除中' : confirming === member.email ? '確認移除?' : '移除'}
                </button>
              )}
            </div>
            {binding === member.email && (
              // Once they have joined through the link: pick the account that is really them
              <div role="group" aria-label={`${member.display_name}是哪個帳號`} className="mt-2 ml-11 flex flex-col gap-1.5">
                <p className="text-[11px] text-text-label">「{member.display_name}」是哪個帳號?</p>
                {accounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => setBindPick({ guest: member, account })}
                    className="text-left text-xs rounded-[8px] bg-bg px-3 py-2 truncate"
                  >
                    <span className="font-semibold text-text-strong">{account.display_name || account.email}</span>
                    {' '}
                    <span className="text-text-label">{account.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* A 長輩 without an email, or anyone who will not join: named here, pickable in fork groups */}
      <form onSubmit={handleAddGuest} className="flex gap-2 mb-3">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="沒有帳號的旅伴,例如爸媽"
          aria-label="沒有帳號的旅伴名字"
          maxLength={20}
          className="flex-1 min-w-0 border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong bg-white focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!guestName.trim() || addingGuest}
          className="shrink-0 bg-bg text-primary rounded-[8px] px-3 text-sm font-semibold disabled:opacity-40"
        >
          ＋ 新增
        </button>
      </form>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 bg-primary text-white rounded-[8px] py-2.5 text-sm font-semibold active:opacity-80"
        >
          分享邀請連結
        </button>
        <button
          onClick={handleCopy}
          aria-label="複製邀請連結"
          className="w-11 bg-bg text-primary rounded-[8px] flex items-center justify-center active:opacity-70"
        >
          {copied ? (
            <Icon name="check" className="text-ok" />
          ) : (
            <Icon name="copy" />
          )}
        </button>
      </div>
      {bindPick && (
        <ConfirmSheet
          title={`把「${bindPick.guest.display_name}」綁定到 ${bindPick.account.display_name || bindPick.account.email}?`}
          description={`分頭行動裡的${bindPick.guest.display_name}會換成 ${bindPick.account.email} 這個帳號,綁定後無法復原。`}
          confirmLabel="確認綁定"
          onConfirm={handleBind}
          onCancel={() => setBindPick(null)}
        />
      )}
    </section>
  )
}
