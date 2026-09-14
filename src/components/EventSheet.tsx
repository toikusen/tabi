import { useState, useEffect, useRef } from 'react'
import type { Day, TripEvent, ForkItem, TripMember } from '../types'
import { createEvent, updateEvent, deleteEvent, moveEvent, reorderEvents, addGuest } from '../lib/db'
import { groupEmails } from '../lib/fork'
import { fmtMD } from '../lib/dates'
import { uploadEventImage } from '../lib/storage'
import { compressImage } from '../lib/image'
import { toast } from '../lib/toast'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { ConfirmSheet } from './ConfirmSheet'

interface Props {
  open: boolean
  event: TripEvent | null
  /** The list this sheet was opened from; null is the wishlist. */
  dayId: string | null
  tripId: string
  events: TripEvent[]
  members?: TripMember[]
  /** Enables the "move to another day" picker when editing. */
  days?: Day[]
  onClose: () => void
}

const emptyFork = (): ForkItem => ({ emails: [], others: false, title: '', location: '', notes: '' })

/** Keeps only http(s) links; blank rows and anything else are dropped. */
const cleanLinks = (links: string[]): string[] =>
  links.map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l))

export function EventSheet({ open, event, dayId, tripId, events, members = [], days = [], onClose }: Props) {
  const isEdit = event !== null
  const [targetDayId, setTargetDayId] = useState<string | null>(dayId)
  const [type, setType] = useState<'shared' | 'fork'>('shared')
  const [title, setTitle] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [forks, setForks] = useState<ForkItem[]>([emptyFork(), emptyFork()])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<string[]>([''])
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** The fork group whose ＋ 旅伴 name input is open, if any */
  const [guestGroup, setGuestGroup] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setType(event?.type ?? 'shared')
    setTitle(event?.title ?? '')
    setTimeStart(event?.time_start ?? '')
    setTimeEnd(event?.time_end ?? '')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    // Defaults fill in fields a group saved by an older build does not have. Only current
    // members stay in a group: a removed companion has no chip, so could never be taken out.
    const items = (event?.fork_items ?? []).map((item) => ({
      ...emptyFork(),
      ...item,
      emails: groupEmails(item, members).filter((email) => members.some((m) => m.email === email)),
      person: undefined,
    }))
    setForks(items.length >= 2 ? items : [items[0] ?? emptyFork(), items[1] ?? emptyFork()])
    setImageFile(null)
    setImageUrl(event?.image_url ?? null)
    setLinks(event?.link_urls?.length ? event.link_urls : [''])
    setTargetDayId(dayId)
    setGuestGroup(null)
    // members stays out: its refetch after ＋ 旅伴 must not wipe the form mid-edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, open, dayId])

  useEffect(() => {
    if (!imageFile) {
      setPreviewSrc(imageUrl)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile, imageUrl])

  if (!open) return null

  const forkIncomplete = type === 'fork' && (
    forks.length < 2 || forks.some(f => (!f.emails.length && !f.others) || !f.title.trim())
  )
  const blockedReason = type === 'shared'
    ? (title.trim() ? null : '請輸入行程名稱')
    : (forkIncomplete ? '每一組都要選人和填活動' : null)

  const updateFork = (i: number, patch: Partial<ForkItem>) =>
    setForks(forks.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  /** Adds a companion with no account to the trip and straight into group i. The chip
   *  itself arrives with the realtime member refetch; the group holds their key already. */
  const handleAddGuest = async (i: number) => {
    const name = guestName.trim()
    if (!name || addingGuest) return
    setAddingGuest(true)
    const key = await addGuest(tripId, name)
    setAddingGuest(false)
    if (!key) {
      toast('新增旅伴失敗,請再試一次')
      return
    }
    setGuestGroup(null)
    setGuestName('')
    // Functional update: the forks captured before the await may be stale by now
    setForks((prev) => prev.map((f, j) => (j === i ? { ...f, emails: [...f.emails, key] } : f)))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Shrink first, then gate: a 12MB phone photo is fine once it is 1600px wide.
    const shrunk = await compressImage(file)
    if (shrunk.size > 5 * 1024 * 1024) {
      toast('圖片不能超過 5MB')
      return
    }
    setImageFile(shrunk)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (blockedReason) return
    setSaving(true)
    try {
      let resolvedImageUrl: string | null = imageUrl
      let preGeneratedId: string | undefined

      if (imageFile) {
        preGeneratedId = isEdit ? event!.id : crypto.randomUUID()
        try {
          resolvedImageUrl = await uploadEventImage(tripId, preGeneratedId, imageFile)
        } catch {
          toast('圖片上傳失敗,請再試一次')
          resolvedImageUrl = isEdit ? (event!.image_url ?? null) : null
        }
      }

      const base = {
        type,
        time_start: timeStart,
        time_end: timeEnd,
        sort_order: isEdit ? event!.sort_order : events.length,
      }
      const data: Omit<TripEvent, 'id'> = type === 'shared'
        ? { ...base, title, location, notes, image_url: resolvedImageUrl, link_urls: cleanLinks(links) }
        : { ...base, title: '', location: '', notes: '', fork_items: forks, image_url: resolvedImageUrl, link_urls: cleanLinks(links) }

      if (isEdit) {
        const result = await updateEvent(event!.id, data)
        if (!result.ok) {
          toast('儲存失敗,請再試一次')
          return
        }
        if (targetDayId !== dayId) {
          const moved = await moveEvent(tripId, event!.id, targetDayId)
          if (!moved.ok) toast('日期沒有更新成功,請再試一次')
        }
      } else {
        const newId = await createEvent(tripId, dayId, { ...data, ...(preGeneratedId ? { id: preGeneratedId } : {}) })
        // Wishlist items have no day to reorder within.
        if (timeStart && dayId) {
          const allEvents: TripEvent[] = [...events, { ...data, id: newId }]
          const sorted = [...allEvents].sort((a, b) => {
            const ta = a.time_start || '\xff'
            const tb = b.time_start || '\xff'
            return ta.localeCompare(tb)
          })
          await reorderEvents(dayId, sorted.map((e) => e.id))
        }
      }

      onClose()
    } catch {
      toast('儲存失敗,請再試一次')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit) return
    setConfirmDelete(false)
    setSaving(true)
    try {
      const result = await deleteEvent(event.id)
      if (!result.ok) {
        toast('刪除失敗,請再試一次')
        return
      }
      onClose()
    } catch {
      toast('刪除失敗,請再試一次')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong bg-white focus:outline-none focus:border-primary'
  const labelCls = 'text-[11px] font-semibold text-text-label mb-1 block'

  // iOS WebKit forces box-sizing: content-box on time inputs, so w-full plus
  // padding overflows into the neighbouring field. Stretching in a flex column
  // sizes the border box instead.
  const timeInputCls = `${inputCls} !w-auto`

  const timeFields = (
    <>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex flex-col">
          <label htmlFor="ev-time-start" className={labelCls}>開始</label>
          <input
            id="ev-time-start"
            type="time"
            className={timeInputCls}
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
          />
        </div>
        <div className="flex-1 flex flex-col">
          <label htmlFor="ev-time-end" className={labelCls}>結束</label>
          <input
            id="ev-time-end"
            type="time"
            className={timeInputCls}
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
        </div>
      </div>
    </>
  )

  return (
    <>
    <BottomSheet
      label={isEdit ? '編輯行程' : '新增行程'}
      onClose={onClose}
      backdropTestId="sheet-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] px-4 pt-3 pb-4 max-h-[90vh] overflow-y-auto"
    >
        <div className="w-9 h-1 bg-border rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold text-text-strong">
            {isEdit ? '編輯行程' : '新增行程'}
          </p>
          {isEdit && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-danger-surface-soft rounded-[8px] px-2.5 py-1.5 disabled:opacity-60"
            >
              <Icon name="trash" size={13} />
              刪除
            </button>
          )}
        </div>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          {(['shared', 'fork'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-[8px] py-1.5 text-xs font-semibold transition-colors ${
                type === t
                  ? 'bg-primary text-white'
                  : 'bg-bg text-text-secondary'
              }`}
            >
              {t === 'shared' ? '共同行程' : '分頭行動'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-label -mt-2.5 mb-4">
          {type === 'shared'
            ? '大家一起去的行程。'
            : '同一時段大家分開行動時使用,各組的安排分開記錄。'}
        </p>

        {/* 換日期／收進想去清單:編輯既有行程時才有意義 */}
        {isEdit && days.length > 0 && (
          <div className="mb-4">
            <label htmlFor="ev-day" className={labelCls}>日期</label>
            <select
              id="ev-day"
              className={inputCls}
              value={targetDayId ?? ''}
              onChange={(e) => setTargetDayId(e.target.value || null)}
            >
              <option value="">想去清單(未排入日期)</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {fmtMD(d.date)}{d.label ? ` ${d.label}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'shared' ? (
          <>
            <div className="mb-3">
              <label htmlFor="ev-title" className={labelCls}>名稱 <span className="text-danger">*</span></label>
              <input
                id="ev-title"
                className={inputCls}
                placeholder="行程名稱"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {blockedReason && type === 'shared' && (
                <p className="text-[11px] text-danger mt-1">{blockedReason}</p>
              )}
            </div>
            {timeFields}
            <div className="mb-3">
              <label htmlFor="ev-location" className={labelCls}>地點</label>
              <input
                id="ev-location"
                className={inputCls}
                placeholder="地點（選填）"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="ev-notes" className={labelCls}>備註</label>
              <textarea
                id="ev-notes"
                className={`${inputCls} h-16 resize-none`}
                placeholder="備註（選填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            {timeFields}
            <div className="flex flex-col gap-2 mb-2">
              {forks.map((item, i) => (
                <div key={i} className="bg-surface-subtle rounded-[8px] p-2 flex flex-col gap-1.5">
                  <div className="flex items-start gap-1.5">
                    <div role="group" aria-label={`第 ${i + 1} 組成員`} className="flex-1 flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const on = item.emails.includes(m.email)
                        return (
                          <button
                            key={m.email}
                            onClick={() => updateFork(i, {
                              emails: on ? item.emails.filter((email) => email !== m.email) : [...item.emails, m.email],
                            })}
                            aria-pressed={on}
                            // One person is in one place at a time
                            disabled={forks.some((f, j) => j !== i && f.emails.includes(m.email))}
                            className={`text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-40 ${
                              on ? 'bg-primary text-white' : 'bg-white text-text-secondary'
                            }`}
                          >
                            {m.display_name || m.email}
                          </button>
                        )
                      })}
                      {/* Everyone named in no other group, companions without an account included */}
                      <button
                        onClick={() => updateFork(i, { others: !item.others })}
                        aria-pressed={item.others}
                        disabled={forks.some((f, j) => j !== i && f.others)}
                        className={`text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-40 ${
                          item.others ? 'bg-primary text-white' : 'bg-white text-text-secondary'
                        }`}
                      >
                        其他人
                      </button>
                      {guestGroup === i ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleAddGuest(i) }}
                          className="w-full flex gap-1.5"
                        >
                          <input
                            autoFocus
                            className={`${inputCls} !py-1.5`}
                            placeholder="名字,例如爸爸"
                            aria-label={`第 ${i + 1} 組新增旅伴`}
                            maxLength={20}
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={!guestName.trim() || addingGuest}
                            className="shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 bg-primary text-white disabled:opacity-40"
                          >
                            加入
                          </button>
                        </form>
                      ) : (
                        // For a 長輩 with no account: joins the trip by name without leaving this sheet
                        <button
                          onClick={() => { setGuestGroup(i); setGuestName('') }}
                          className="text-xs font-semibold rounded-full px-3 py-1.5 border border-dashed border-icon-muted text-primary"
                        >
                          ＋ 旅伴
                        </button>
                      )}
                    </div>
                    {forks.length > 2 && (
                      <button
                        onClick={() => setForks(forks.filter((_, j) => j !== i))}
                        aria-label={`移除第 ${i + 1} 組`}
                        className="shrink-0 w-11 h-11 -my-1 -mr-1 flex items-center justify-center text-text-label"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="活動"
                    aria-label={`第 ${i + 1} 組活動`}
                    value={item.title}
                    onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, title: e.target.value } : f))}
                  />
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="地點"
                    aria-label={`第 ${i + 1} 組地點`}
                    value={item.location}
                    onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, location: e.target.value } : f))}
                  />
                </div>
              ))}
              <button
                onClick={() => setForks([...forks, emptyFork()])}
                className="w-full border border-dashed border-icon-muted rounded-[8px] py-2 text-xs font-semibold text-primary mb-2"
              >
                ＋ 新增一組
              </button>
              {blockedReason && type === 'fork' && (
                <p className="text-[11px] text-danger">{blockedReason}</p>
              )}
            </div>
          </>
        )}

        {/* Image picker */}
        <div className="mb-3">
          <p className={labelCls}>圖片（選填）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewSrc ? (
            <div className="flex items-center gap-3">
              <img src={previewSrc} alt="preview" className="w-16 h-16 rounded-[8px] object-cover border border-border" />
              <button
                onClick={handleRemoveImage}
                className="text-xs text-danger font-semibold"
              >
                移除
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-icon-muted rounded-[8px] py-3 text-sm text-text-label flex items-center justify-center gap-1.5"
            >
              <span className="text-base">＋</span> 新增圖片
            </button>
          )}
        </div>

        {/* Links */}
        <div className="mb-4">
          <p className={labelCls}>景點連結（選填）</p>
          <div className="flex flex-col gap-1.5">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://..."
                  aria-label={`連結 ${i + 1}`}
                  value={link}
                  onChange={(e) => setLinks(links.map((l, j) => j === i ? e.target.value : l))}
                />
                {links.length > 1 && (
                  <button
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    aria-label={`移除連結 ${i + 1}`}
                    className="shrink-0 w-11 h-11 -my-1 -mr-1 flex items-center justify-center text-text-label"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setLinks([...links, ''])}
            className="mt-1.5 w-full border border-dashed border-icon-muted rounded-[8px] py-2 text-xs font-semibold text-primary"
          >
            ＋ 新增連結
          </button>
        </div>

        <div className="sticky bottom-0 bg-white pt-2 pb-4 -mb-4">
          <button
            onClick={handleSave}
            disabled={saving || !!blockedReason}
            className="w-full bg-primary text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            儲存
          </button>
        </div>
    </BottomSheet>
    {confirmDelete && (
      <ConfirmSheet
        title="確定刪除這個行程?"
        description="此動作無法復原。"
        confirmLabel="刪除"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  )
}
