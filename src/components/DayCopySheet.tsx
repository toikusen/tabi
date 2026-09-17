import { fmtMD } from '../lib/dates'
import { BottomSheet } from './BottomSheet'
import type { Day } from '../types'

interface Props {
  /** The day being copied; it is not offered as a target. */
  from: Day
  days: Day[]
  count: number
  onPick: (toDayId: string) => void
  onClose: () => void
}

const dayLabel = (day: Day) => `${fmtMD(day.date)}${day.label ? ` ${day.label}` : ''}`

/** Picks the day to copy a day's events onto. Copies, never moves — dragging a
 *  card already moves one, and the reason to copy is to keep both. */
export function DayCopySheet({ from, days, count, onPick, onClose }: Props) {
  const targets = days.filter((d) => d.id !== from.id)

  return (
    <BottomSheet
      label={`把 ${dayLabel(from)} 的行程複製到`}
      onClose={onClose}
      backdropTestId="copy-day-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] max-w-lg mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto"
    >
      <p className="text-[15px] font-bold text-text-strong">複製到哪一天?</p>
      <p className="text-xs text-text-label mt-2">
        {dayLabel(from)} 的 {count} 筆行程會加在該天的最後面,原本的保持不動。
      </p>

      <div className="flex flex-col gap-1.5 mt-4">
        {targets.map((day) => (
          <button
            key={day.id}
            onClick={() => onPick(day.id)}
            className="text-left text-sm rounded-[8px] bg-bg px-3 py-2.5 text-text-strong active:opacity-70"
          >
            {dayLabel(day)}
          </button>
        ))}
        {targets.length === 0 && (
          <p className="text-xs text-text-label">這趟只有一天,沒有別的日子可以複製過去。</p>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full border border-border text-text-secondary rounded-[10px] py-2.5 text-sm font-semibold mt-4 active:opacity-70"
      >
        取消
      </button>
    </BottomSheet>
  )
}
