import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: (id: string | null) => mockUseTrip(id) }))
vi.mock('../../hooks/useSyncStatus', () => ({ useSyncStatus: () => 'connected' }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} } }),
}))
vi.mock('../../components/DaySection', () => ({
  DaySection: ({ day, events, onCreate, onOpen }: {
    day: { id: string }
    events: { id: string }[]
    onCreate: (dayId: string) => void
    onOpen: (event: { id: string }, dayId: string) => void
  }) => (
    <div data-testid="day-section">
      {events.map(e => (
        <div key={e.id} id={`event-${e.id}`}>
          <button onClick={() => onOpen(e, day.id)}>{`open ${e.id}`}</button>
        </div>
      ))}
      <button onClick={() => onCreate(day.id)}>{`add to ${day.id}`}</button>
    </div>
  ),
}))
// Stand-ins that report which event and list the page handed them
vi.mock('../../components/EventSheet', () => ({
  EventSheet: ({ open, event, dayId }: { open: boolean; event: { id: string } | null; dayId: string | null }) =>
    open ? <div data-testid="event-sheet">{`${dayId ?? 'wishlist'}/${event?.id ?? 'new'}`}</div> : null,
}))
vi.mock('../../components/EventDetailSheet', () => ({
  EventDetailSheet: ({ open, event, onEdit }: { open: boolean; event: { id: string } | null; onEdit: () => void }) =>
    open ? (
      <div data-testid="detail-sheet">
        {event?.id}
        <button onClick={onEdit}>detail-edit</button>
      </div>
    ) : null,
}))
vi.mock('../../components/SyncIndicator', () => ({ SyncIndicator: () => null }))
vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TimelinePage } from '../../pages/TimelinePage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trips/:tripId" element={<TimelinePage />} />
        <Route path="/trips/:tripId/settings" element={<div data-testid="settings-page" />} />
        <Route path="/trips/:tripId/overview" element={<div data-testid="overview-page" />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TimelinePage', () => {
  it('opens the overview from the 總覽 tab', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')
    await userEvent.click(screen.getByRole('button', { name: '總覽' }))
    expect(screen.getByTestId('overview-page')).toBeInTheDocument()
  })

  it('feeds the route param tripId into useTrip and renders the trip', () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩 2026', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')

    expect(mockUseTrip).toHaveBeenCalledWith('t1')
    expect(screen.getByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByTestId('day-section')).toBeInTheDocument()
  })

  it('keeps 重要資訊 off the first screen', () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩 2026', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02', notes: 'BR116 07:35' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')

    expect(screen.queryByText('重要資訊')).not.toBeInTheDocument()
    expect(screen.queryByText('BR116 07:35')).not.toBeInTheDocument()
  })

  it('redirects to / when the trip fails to load (not a member)', () => {
    mockUseTrip.mockReturnValue({ trip: null, days: [], eventsByDay: {}, loading: false })

    renderAt('/trips/unknown')

    expect(screen.getByTestId('trip-list')).toBeInTheDocument()
  })

  it('scrolls to the first event that has not ended', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T10:00:00'))

    try {
      mockUseTrip.mockReturnValue({
        trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-10-12', end_date: '2026-10-13' },
        days: [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }],
        eventsByDay: {
          d1: [
            { id: 'done', type: 'shared', title: 'x', time_start: '07:00', time_end: '08:00', location: '', notes: '', sort_order: 0 },
            { id: 'live', type: 'shared', title: 'y', time_start: '09:00', time_end: '12:00', location: '', notes: '', sort_order: 1 },
          ],
        },
        loading: false,
      })

      renderAt('/trips/t1')
      expect(document.getElementById('event-live')).toBeTruthy()
      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends the 今天 tab to the event that has not ended, not to a summary block', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.setSystemTime(new Date('2026-10-12T10:00:00'))

    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-10-12', end_date: '2026-10-13' },
      days: [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }],
      eventsByDay: {
        d1: [
          { id: 'done', type: 'shared', title: 'x', time_start: '07:00', time_end: '08:00', location: '', notes: '', sort_order: 0 },
          { id: 'live', type: 'shared', title: 'y', time_start: '09:00', time_end: '12:00', location: '', notes: '', sort_order: 1 },
        ],
      },
      loading: false,
    })

    renderAt('/trips/t1')
    scrollIntoView.mockClear()

    await userEvent.click(screen.getByRole('button', { name: '今天' }))

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('event-live'))
    vi.useRealTimers()
  })

  it('opens settings from the header gear', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')
    await userEvent.click(screen.getByRole('button', { name: '旅程設定' }))
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('mounts one sheet for the whole trip, not one per day', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-03' },
      days: [
        { id: 'd1', date: '2026-08-01', label: '', sort_order: 0 },
        { id: 'd2', date: '2026-08-02', label: '', sort_order: 1 },
        { id: 'd3', date: '2026-08-03', label: '', sort_order: 2 },
      ],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')

    // Three days, and nothing mounted until something is opened
    expect(screen.getAllByTestId('day-section')).toHaveLength(3)
    expect(screen.queryByTestId('event-sheet')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'add to d2' }))
    const sheets = screen.getAllByTestId('event-sheet')
    expect(sheets).toHaveLength(1)
    expect(sheets[0]).toHaveTextContent('d2/new')
  })

  it('carries the day through the detail sheet into the edit sheet', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [
        { id: 'd1', date: '2026-08-01', label: '', sort_order: 0 },
        { id: 'd2', date: '2026-08-02', label: '', sort_order: 1 },
      ],
      eventsByDay: {
        d2: [{ id: 'e9', type: 'shared', title: '水族館', time_start: '', time_end: '', location: '', notes: '', sort_order: 0 }],
      },
      loading: false,
    })

    renderAt('/trips/t1')

    await userEvent.click(screen.getByRole('button', { name: 'open e9' }))
    expect(screen.getByTestId('detail-sheet')).toHaveTextContent('e9')

    await userEvent.click(screen.getByRole('button', { name: 'detail-edit' }))
    expect(screen.queryByTestId('detail-sheet')).toBeNull()
    // The day it was opened from, so saving does not move it elsewhere
    expect(screen.getByTestId('event-sheet')).toHaveTextContent('d2/e9')
  })

  it('opens a wish in the edit sheet, where it can be given a date', async () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      eventsByDay: {
        wishlist: [{ id: 'w1', type: 'shared', title: '古宇利島', time_start: '', time_end: '', location: '', notes: '', sort_order: 0 }],
      },
      loading: false,
    })

    renderAt('/trips/t1')

    await userEvent.click(screen.getByText('古宇利島'))
    expect(screen.getByTestId('event-sheet')).toHaveTextContent('wishlist/w1')
  })

  it('puts each day title on its date chip, falling back to the weekday', () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '東京', owner_email: 'sei@test.com', members: [], start_date: '2026-09-14', end_date: '2026-09-15' },
      days: [
        { id: 'd1', date: '2026-09-14', label: '飛行日', sort_order: 0 },
        { id: 'd2', date: '2026-09-15', label: '', sort_order: 1 },
      ],
      eventsByDay: {},
      loading: false,
    })

    renderAt('/trips/t1')

    expect(screen.getByRole('button', { name: '9/14 飛行日' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '9/15 二' })).toBeInTheDocument()
  })
})
