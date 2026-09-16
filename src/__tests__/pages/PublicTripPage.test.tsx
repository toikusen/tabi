// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockGetPublicTrip = vi.fn()
vi.mock('../../lib/db', () => ({
  getPublicTrip: (...args: unknown[]) => mockGetPublicTrip(...args),
}))

import { PublicTripPage } from '../../pages/PublicTripPage'

const ev = (over: Record<string, unknown> = {}) => ({
  type: 'shared', title: '早餐', time_start: '08:30', time_end: '09:30',
  location: '國際通', notes: '', groups: [], ...over,
})

const trip = {
  name: '沖繩四日遊',
  start_date: '2031-02-01',
  end_date: '2031-02-02',
  notes: 'BR116 07:35 桃園→那霸',
  days: [
    { date: '2031-02-01', label: '飛行日', events: [ev()] },
    { date: '2031-02-02', label: '', events: [] },
  ],
}

function renderAt(token = 'tok-1') {
  return render(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <Routes>
        <Route path="/s/:token" element={<PublicTripPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PublicTripPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the itinerary behind the token in the url', async () => {
    mockGetPublicTrip.mockResolvedValue(trip)
    renderAt('tok-abc')
    expect(await screen.findByText('沖繩四日遊')).toBeInTheDocument()
    expect(mockGetPublicTrip).toHaveBeenCalledWith('tok-abc')
  })

  it('shows the days, their titles and the events', async () => {
    mockGetPublicTrip.mockResolvedValue(trip)
    renderAt()

    expect(await screen.findByText('早餐')).toBeInTheDocument()
    expect(screen.getByText('飛行日')).toBeInTheDocument()
    expect(screen.getByText(/08:30 – 09:30/)).toBeInTheDocument()
    // A day with nothing on it still appears, so nobody thinks it was dropped
    expect(screen.getByText('還沒安排')).toBeInTheDocument()
  })

  it('carries 重要資訊, which is the half people actually need on the day', async () => {
    mockGetPublicTrip.mockResolvedValue(trip)
    renderAt()
    expect(await screen.findByText('重要資訊')).toBeInTheDocument()
    expect(screen.getByText(/BR116 07:35/)).toBeInTheDocument()
  })

  it('leaves out 重要資訊 entirely when the trip has none', async () => {
    mockGetPublicTrip.mockResolvedValue({ ...trip, notes: '   ' })
    renderAt()
    await screen.findByText('沖繩四日遊')
    expect(screen.queryByText('重要資訊')).toBeNull()
  })

  it('names each fork group and what it is doing', async () => {
    mockGetPublicTrip.mockResolvedValue({
      ...trip,
      days: [{
        date: '2031-02-01', label: '', events: [ev({
          type: 'fork', title: '', location: '',
          groups: [
            { label: '爸爸、媽媽', title: '潛水', location: '真榮田岬' },
            { label: '其他人', title: '逛街', location: '' },
          ],
        })],
      }],
    })
    renderAt()

    expect(await screen.findByText('分頭行動')).toBeInTheDocument()
    expect(screen.getByText('爸爸、媽媽')).toBeInTheDocument()
    expect(screen.getByText('潛水')).toBeInTheDocument()
    expect(screen.getByText('其他人')).toBeInTheDocument()
    expect(screen.getByText('逛街')).toBeInTheDocument()
  })

  it('links a place to Google Maps, the one thing worth tapping here', async () => {
    mockGetPublicTrip.mockResolvedValue(trip)
    renderAt()
    const link = await screen.findByRole('link', { name: /國際通/ })
    expect(link.getAttribute('href')).toContain('google.com/maps')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('says a revoked link is dead without explaining why', async () => {
    mockGetPublicTrip.mockResolvedValue(null)
    renderAt('revoked')
    expect(await screen.findByText(/這個連結已失效/)).toBeInTheDocument()
    expect(screen.queryByText('沖繩四日遊')).toBeNull()
  })

  it('says so while it is still fetching', () => {
    mockGetPublicTrip.mockReturnValue(new Promise(() => {}))
    renderAt()
    expect(screen.getByText('載入行程中...')).toBeInTheDocument()
  })

  it('offers nothing to edit: no buttons at all', async () => {
    mockGetPublicTrip.mockResolvedValue(trip)
    renderAt()
    await screen.findByText('沖繩四日遊')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
