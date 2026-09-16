import { useState } from 'react'
import { todayStr } from '../lib/dates'
import { BottomSheet } from './BottomSheet'

interface Props {
  /** Source trip name, used to seed the new one. */
  sourceName: string
  /** How many days the copy will cover; the length is kept. */
  dayCount: number
  busy: boolean
  onCopy: (name: string, startDate: string) => void
  onClose: () => void
}

/** Names the copy and picks the date it starts on. The trip keeps its length,
 *  so only a start date is asked for. */
export function TripCopySheet({ sourceName, dayCount, busy, onCopy, onClose }: Props) {
  const [name, setName] = useState(`${sourceName} 複本`)
  const [start, setStart] = useState(() => todayStr())

  const blocked = !name.trim() || !start

  return (
    <BottomSheet
      label="複製旅程"
      onClose={onClose}
      backdropTestId="copy-trip-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] max-w-lg mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <p className="text-[15px] font-bold text-text-strong">複製旅程</p>
      <p className="text-xs text-text-label mt-2 leading-relaxed">
        行程、想去清單、分頭行動的分組和重要資訊都會一起複製,長度一樣是 {dayCount} 天。
        <br />
        旅伴要重新邀請,圖片不會複製。
      </p>

      <label htmlFor="copy-name" className="text-[11px] font-semibold text-text-label mt-4 mb-1 block">
        新旅程名稱
      </label>
      <input
        id="copy-name"
        className="w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong bg-white focus:outline-none focus:border-primary"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="copy-start" className="text-[11px] font-semibold text-text-label mt-3 mb-1 block">
        出發日期
      </label>
      <input
        id="copy-start"
        type="date"
        className="w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong bg-white focus:outline-none focus:border-primary"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />

      <div className="flex gap-2 mt-5">
        <button
          onClick={onClose}
          disabled={busy}
          className="flex-1 border border-border text-text-secondary rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-60 active:opacity-70"
        >
          取消
        </button>
        <button
          onClick={() => onCopy(name.trim(), start)}
          disabled={busy || blocked}
          className="flex-1 bg-primary text-white rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-40 active:opacity-80"
        >
          {busy ? '複製中...' : '複製'}
        </button>
      </div>
    </BottomSheet>
  )
}
