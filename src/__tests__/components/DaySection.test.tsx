import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  updateDayLabel: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

import { DaySection } from '../../components/DaySection'
import { updateDayLabel } from '../../lib/db'
import { toast } from '../../lib/toast'

const day = { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }
const now = new Date('2026-10-12T10:00:00')
/** The page owns the sheets and the clock now, so every render supplies them. */
const sheets = { now, onCreate: () => {}, onOpen: () => {} }
const ev = (id: string, time_start: string) => ({
  id, type: 'shared' as const, title: id, time_start, time_end: '',
  location: '', notes: '', sort_order: 0,
})

describe('DaySection now line', () => {
  it('places the now line after the last started event despite list order', () => {
    render(
      <DaySection day={day} members={[]} events={[ev('b', '14:00'), ev('a', '09:00'), ev('c', '18:00')]} {...sheets} />
    )
    // Accessible name includes the time suffix (e.g. "b 14:00"), so match on the leading letter.
    const cards = screen.getAllByRole('button', { name: /^[abc](?:\s|$)/ })
    const line = screen.getByTestId('now-line')
    // The line sits between 'a' (started) and 'c' (not yet).
    expect(line.compareDocumentPosition(cards[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(line.compareDocumentPosition(cards[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no now line on a day that is not today', () => {
    render(
      <DaySection day={{ ...day, date: '2026-10-13' }} members={[]} events={[ev('a', '09:00')]} {...sheets} />
    )
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument()
  })

  it('shows the forecast beside the date when there is one', () => {
    render(
      <DaySection day={day} members={[]} events={[]} {...sheets} weather={{ code: 61, max: 29, min: 24 }} />
    )
    expect(screen.getByLabelText('天氣 最高 29 度 最低 24 度')).toHaveTextContent('29°/24°')
  })

  it('shows no forecast for a day outside the window', () => {
    render(<DaySection day={day} members={[]} events={[]} {...sheets} />)
    expect(screen.queryByLabelText(/天氣/)).not.toBeInTheDocument()
  })

  it('shows a visible drag handle', () => {
    render(<DaySection day={day} members={[]} events={[ev('a', '09:00')]} {...sheets} />)
    expect(screen.getByRole('button', { name: '拖曳排序' })).toBeVisible()
  })
})

describe('DaySection empty day', () => {
  it('offers itself as a drop target instead of rendering nothing', () => {
    render(<DaySection day={day} members={[]} events={[]} {...sheets} />)
    expect(screen.getByText('還沒安排,把卡片拖來這裡')).toBeVisible()
  })

  it('drops the hint once the day has something in it', () => {
    render(<DaySection day={day} members={[]} events={[ev('a', '09:00')]} {...sheets} />)
    expect(screen.queryByText('還沒安排,把卡片拖來這裡')).toBeNull()
  })
})

describe('DaySection label editing', () => {
  it('reverts the label and toasts when updateDayLabel fails', async () => {
    vi.mocked(updateDayLabel).mockResolvedValueOnce({ ok: false })
    render(
      <DaySection day={{ ...day, label: '原本標籤' }} members={[]} events={[]} {...sheets} />
    )

    fireEvent.click(screen.getByText('原本標籤'))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '新標籤' } })
    fireEvent.blur(input)

    await waitFor(() => expect(toast).toHaveBeenCalledWith('標籤儲存失敗,請再試一次'))
    expect(screen.getByText('原本標籤')).toBeInTheDocument()
  })

  it('edits the current label, not the one it was first rendered with', () => {
    vi.mocked(updateDayLabel).mockClear()
    const { rerender } = render(<DaySection day={{ ...day, label: '舊' }} members={[]} events={[]} {...sheets} />)
    // A tripmate renames the day; realtime pushes the new label in.
    rerender(<DaySection day={{ ...day, label: '新宿' }} members={[]} events={[]} {...sheets} />)

    fireEvent.click(screen.getByText('新宿'))
    const input = screen.getByLabelText('日期標籤')
    expect(input).toHaveValue('新宿')
    fireEvent.blur(input)

    expect(updateDayLabel).not.toHaveBeenCalled()
  })

  it('discards the edit on Escape', () => {
    vi.mocked(updateDayLabel).mockClear()
    render(<DaySection day={{ ...day, label: '新宿' }} members={[]} events={[]} {...sheets} />)

    fireEvent.click(screen.getByText('新宿'))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '購物日' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByLabelText('日期標籤')).toBeNull()
    expect(updateDayLabel).not.toHaveBeenCalled()
  })

  it('saves the trimmed title on Enter from the empty state', () => {
    vi.mocked(updateDayLabel).mockClear()
    render(<DaySection day={day} members={[]} events={[]} {...sheets} />)

    fireEvent.click(screen.getByRole('button', { name: '當天主題' }))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '  飛行日 ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(updateDayLabel).toHaveBeenCalledWith('d1', '飛行日')
  })
})

describe('DaySection clash warning', () => {
  const span = (id: string, time_start: string, time_end: string) => ({ ...ev(id, time_start), time_end })

  it('marks both events whose times run over each other', () => {
    render(
      <DaySection day={day} members={[]} events={[span('a', '09:00', '12:00'), span('b', '11:00', '13:00')]} {...sheets} />
    )
    expect(screen.getAllByText('時間重疊')).toHaveLength(2)
  })

  it('says nothing about a day that merely runs back to back', () => {
    render(
      <DaySection day={day} members={[]} events={[span('a', '09:00', '12:00'), span('b', '12:00', '14:00')]} {...sheets} />
    )
    expect(screen.queryByText('時間重疊')).toBeNull()
  })

  it('marks a 分頭行動 card too, since it is one event like any other', () => {
    const fork = {
      ...span('f', '10:00', '14:00'),
      type: 'fork' as const,
      fork_items: [
        { emails: [], others: false, title: '看海', location: '', notes: '' },
        { emails: [], others: true, title: '逛街', location: '', notes: '' },
      ],
    }
    render(
      <DaySection day={day} members={[]} events={[fork, span('b', '13:00', '15:00')]} {...sheets} />
    )
    expect(screen.getAllByText('時間重疊')).toHaveLength(2)
  })

  it('leaves an event with no end time out of it', () => {
    render(
      <DaySection day={day} members={[]} events={[span('a', '09:00', ''), span('b', '09:30', '10:30')]} {...sheets} />
    )
    expect(screen.queryByText('時間重疊')).toBeNull()
  })
})

describe('DaySection route link', () => {
  const at = (id: string, location: string) => ({ ...ev(id, ''), location })

  it('chains the day places into one Google Maps route, in list order', () => {
    render(
      <DaySection
        day={day}
       
        members={[]}
        events={[at('a', '那霸機場'), at('b', '美麗海水族館'), at('c', '國際通')]} {...sheets}
      />
    )
    const link = screen.getByRole('link', { name: /當日路線/ })
    const href = decodeURIComponent(link.getAttribute('href')!)
    expect(href).toContain('origin=那霸機場')
    expect(href).toContain('waypoints=美麗海水族館')
    expect(href).toContain('destination=國際通')
  })

  it('stays out of the way when there is nothing to route', () => {
    render(<DaySection day={day} members={[]} events={[at('a', '那霸機場')]} {...sheets} />)
    expect(screen.queryByRole('link', { name: /當日路線/ })).toBeNull()
  })
})
