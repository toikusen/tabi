import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  updateDayLabel: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))
vi.mock('../../components/EventSheet', () => ({ EventSheet: () => null }))
vi.mock('../../components/EventDetailSheet', () => ({ EventDetailSheet: () => null }))
vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { DaySection } from '../../components/DaySection'
import { updateDayLabel } from '../../lib/db'
import { toast } from '../../lib/toast'

const day = { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }
const ev = (id: string, time_start: string) => ({
  id, type: 'shared' as const, title: id, time_start, time_end: '',
  location: '', notes: '', sort_order: 0,
})

describe('DaySection now line', () => {
  it('places the now line after the last started event despite list order', () => {
    render(
      <DaySection day={day} tripId="t1" members={[]} events={[ev('b', '14:00'), ev('a', '09:00'), ev('c', '18:00')]} />
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
      <DaySection day={{ ...day, date: '2026-10-13' }} tripId="t1" members={[]} events={[ev('a', '09:00')]} />
    )
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument()
  })

  it('shows a visible drag handle', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[ev('a', '09:00')]} />)
    expect(screen.getByRole('button', { name: '拖曳排序' })).toBeVisible()
  })
})

describe('DaySection empty day', () => {
  it('offers itself as a drop target instead of rendering nothing', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[]} />)
    expect(screen.getByText('還沒安排,把卡片拖來這裡')).toBeVisible()
  })

  it('drops the hint once the day has something in it', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[ev('a', '09:00')]} />)
    expect(screen.queryByText('還沒安排,把卡片拖來這裡')).toBeNull()
  })
})

describe('DaySection label editing', () => {
  it('reverts the label and toasts when updateDayLabel fails', async () => {
    vi.mocked(updateDayLabel).mockResolvedValueOnce({ ok: false })
    render(
      <DaySection day={{ ...day, label: '原本標籤' }} tripId="t1" members={[]} events={[]} />
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
    const { rerender } = render(<DaySection day={{ ...day, label: '舊' }} tripId="t1" members={[]} events={[]} />)
    // A tripmate renames the day; realtime pushes the new label in.
    rerender(<DaySection day={{ ...day, label: '新宿' }} tripId="t1" members={[]} events={[]} />)

    fireEvent.click(screen.getByText('新宿'))
    const input = screen.getByLabelText('日期標籤')
    expect(input).toHaveValue('新宿')
    fireEvent.blur(input)

    expect(updateDayLabel).not.toHaveBeenCalled()
  })

  it('discards the edit on Escape', () => {
    vi.mocked(updateDayLabel).mockClear()
    render(<DaySection day={{ ...day, label: '新宿' }} tripId="t1" members={[]} events={[]} />)

    fireEvent.click(screen.getByText('新宿'))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '購物日' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByLabelText('日期標籤')).toBeNull()
    expect(updateDayLabel).not.toHaveBeenCalled()
  })

  it('saves the trimmed title on Enter from the empty state', () => {
    vi.mocked(updateDayLabel).mockClear()
    render(<DaySection day={day} tripId="t1" members={[]} events={[]} />)

    fireEvent.click(screen.getByRole('button', { name: '當天主題' }))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '  飛行日 ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(updateDayLabel).toHaveBeenCalledWith('d1', '飛行日')
  })
})

describe('DaySection route link', () => {
  const at = (id: string, location: string) => ({ ...ev(id, ''), location })

  it('chains the day places into one Google Maps route, in list order', () => {
    render(
      <DaySection
        day={day}
        tripId="t1"
        members={[]}
        events={[at('a', '那霸機場'), at('b', '美麗海水族館'), at('c', '國際通')]}
      />
    )
    const link = screen.getByRole('link', { name: /當日路線/ })
    const href = decodeURIComponent(link.getAttribute('href')!)
    expect(href).toContain('origin=那霸機場')
    expect(href).toContain('waypoints=美麗海水族館')
    expect(href).toContain('destination=國際通')
  })

  it('stays out of the way when there is nothing to route', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[at('a', '那霸機場')]} />)
    expect(screen.queryByRole('link', { name: /當日路線/ })).toBeNull()
  })
})
