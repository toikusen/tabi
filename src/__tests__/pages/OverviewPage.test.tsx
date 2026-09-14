import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { TripEvent } from '../../types'

const mockUseTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: (id: string | null) => mockUseTrip(id) }))

import { OverviewPage } from '../../pages/OverviewPage'

const trip = {
  id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [],
  start_date: '2026-10-12', end_date: '2026-10-13', notes: '',
}
const days = [
  { id: 'd1', date: '2026-10-12', label: '飛行日', sort_order: 0 },
  { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 },
]
const ev = (id: string, title: string, time_start: string, type: TripEvent['type'] = 'shared'): TripEvent => ({
  id, type, title, time_start, time_end: '', location: '', notes: '', sort_order: 0,
})

function renderOverview(eventsByDay: Record<string, TripEvent[]>) {
  mockUseTrip.mockReturnValue({ trip, days, eventsByDay, loading: false })
  return render(
    <MemoryRouter initialEntries={['/trips/t1/overview']}>
      <Routes>
        <Route path="/trips/:tripId/overview" element={<OverviewPage />} />
        <Route path="/trips/:tripId" element={<div data-testid="timeline-page" />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

/** Body rows, top to bottom: 早, 午, 晚. */
const bandRow = (i: number) => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')[i]

describe('OverviewPage', () => {
  it('lines days up by time band, so one day\'s lunch sits level with the next day\'s', () => {
    renderOverview({
      d1: [ev('b', '早餐', '08:00'), ev('s', '首里城', '10:00'), ev('l', '午餐', '12:30')],
      d2: [ev('r', '拉麵', '13:00'), ev('f', '', '18:00', 'fork')],
    })

    expect(mockUseTrip).toHaveBeenCalledWith('t1')
    expect(within(bandRow(0)).getByText('早餐')).toBeInTheDocument()
    expect(within(bandRow(0)).getByText('首里城')).toBeInTheDocument()
    expect(within(bandRow(0)).queryByText('拉麵')).not.toBeInTheDocument()
    expect(within(bandRow(1)).getByText('午餐')).toBeInTheDocument()
    expect(within(bandRow(1)).getByText('拉麵')).toBeInTheDocument()
    // A fork event has no title of its own
    expect(within(bandRow(2)).getByText('分頭行動')).toBeInTheDocument()
  })

  it('opens an event\'s details in place instead of leaving the overview', async () => {
    renderOverview({ d1: [ev('l', '午餐', '12:30')] })

    await userEvent.click(screen.getByRole('button', { name: '午餐' }))

    expect(screen.getByRole('dialog', { name: '行程詳情' })).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-page')).not.toBeInTheDocument()
  })

  it('marks today\'s column', () => {
    vi.setSystemTime(new Date('2026-10-13T09:00:00'))
    try {
      renderOverview({})
      expect(screen.getByRole('columnheader', { name: /10\/13/ })).toHaveAttribute('aria-current', 'date')
      expect(screen.getByRole('columnheader', { name: /10\/12/ })).not.toHaveAttribute('aria-current')
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes back to the timeline from the 行程 tab', async () => {
    renderOverview({})
    await userEvent.click(screen.getByRole('button', { name: '行程' }))
    expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
  })

  it('redirects to / when the trip fails to load', () => {
    mockUseTrip.mockReturnValue({ trip: null, days: [], eventsByDay: {}, loading: false })
    render(
      <MemoryRouter initialEntries={['/trips/x/overview']}>
        <Routes>
          <Route path="/trips/:tripId/overview" element={<OverviewPage />} />
          <Route path="/" element={<div data-testid="trip-list" />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByTestId('trip-list')).toBeInTheDocument()
  })
})
