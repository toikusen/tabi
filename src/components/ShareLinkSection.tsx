import { useState } from 'react'
import { setTripShare } from '../lib/db'
import { toast } from '../lib/toast'
import { Icon } from './Icon'
import { ConfirmSheet } from './ConfirmSheet'
import type { Trip } from '../types'

interface Props {
  trip: Trip & { share_token?: string | null }
  isOwner: boolean
}

const linkFor = (token: string) => `${window.location.origin}/s/${token}`

/**
 * The read-only link for people with no account, replacing a plain-text copy
 * that went stale the moment the plan changed.
 *
 * Only the owner can turn it on or off: handing out the whole itinerary is not
 * a decision any member should make for the rest, and nor is killing a link
 * somebody else handed out. Everyone can copy it, since sharing it is the
 * point. The token rides along on the trip row, so no extra fetch.
 */
export function ShareLinkSection({ trip, isOwner }: Props) {
  const token = trip.share_token ?? null
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<'regenerate' | 'stop' | null>(null)

  const apply = async (enabled: boolean, failure: string) => {
    setConfirm(null)
    setBusy(true)
    try {
      // The new token arrives on the trip row via realtime, so nothing to store here
      if (!(await setTripShare(trip.id, enabled)).ok) toast(failure)
    } catch {
      toast(failure)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(linkFor(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('複製失敗,請長按網址手動複製')
    }
  }

  return (
    <section className="bg-white rounded-[12px] p-4 border border-border">
      <p className="text-xs font-semibold text-text-label mb-3">唯讀連結</p>

      {token ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="唯讀連結"
              value={linkFor(token)}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 border border-border rounded-[8px] px-3 py-2 text-xs text-text-secondary bg-bg"
            />
            <button
              onClick={handleCopy}
              aria-label="複製唯讀連結"
              className="w-11 bg-bg text-primary rounded-[8px] flex items-center justify-center shrink-0 active:opacity-70"
            >
              <Icon name={copied ? 'check' : 'copy'} className={copied ? 'text-ok' : undefined} />
            </button>
          </div>

          {isOwner && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setConfirm('regenerate')}
                disabled={busy}
                className="flex-1 border border-border text-text-strong rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                重新產生
              </button>
              <button
                onClick={() => setConfirm('stop')}
                disabled={busy}
                className="flex-1 bg-danger-surface text-danger rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                關閉分享
              </button>
            </div>
          )}

          <p className="text-[11px] text-text-label mt-2">
            拿到連結的人不用登入就看得到整份行程,包含重要資訊。
          </p>
        </>
      ) : isOwner ? (
        <>
          <button
            onClick={() => apply(true, '建立連結失敗,請再試一次')}
            disabled={busy}
            className="w-full border border-border text-text-strong rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? '建立中...' : '建立唯讀連結'}
          </button>
          <p className="text-[11px] text-text-label mt-2">
            給沒有帳號的人看,而且會跟著你的修改更新。拿到連結的人都看得到,包含重要資訊。
          </p>
        </>
      ) : (
        <p className="text-[11px] text-text-label">主揪還沒建立唯讀連結。</p>
      )}

      {confirm === 'regenerate' && (
        <ConfirmSheet
          title="重新產生唯讀連結?"
          description="舊的連結會立刻失效,已經拿到舊連結的人就看不到了。"
          confirmLabel="重新產生"
          onConfirm={() => apply(true, '重新產生失敗,請再試一次')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'stop' && (
        <ConfirmSheet
          title="關閉唯讀分享?"
          description="連結會立刻失效,而且無法復原。之後可以再建立一個新的。"
          confirmLabel="關閉分享"
          destructive
          onConfirm={() => apply(false, '關閉失敗,請再試一次')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  )
}
