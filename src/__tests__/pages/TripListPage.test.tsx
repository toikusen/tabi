import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Wraps the real useNavigate so existing `toHaveBeenCalledWith` assertions keep
// working while navigation still actually happens (needed for the empty-state
// CTA test, which checks the resulting route rendered).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate()
      return (...args: Parameters<typeof navigate>) => {
        mockNavigate(...args)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (navigate as any)(...args)
      }
    },
  }
})

const mockListMyTrips = vi.fn()
vi.mock('../../lib/db', () => ({
  listMyTrips: () => mockListMyTrips(),
  updateMyDisplayName: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} }, signOut: vi.fn() }),
}))

vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TripListPage } from '../../pages/TripListPage'
import { todayStr } from '../../lib/dates'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

function futureDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return todayStr(d)
}

const members = [
  { email: 'sei@test.com', display_name: '小安', avatar_url: '' },
  { email: 'b@test.com', display_name: '阿傑', avatar_url: '' },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<TripListPage />} />
        <Route path="/trips/new" element={<div data-testid="new-trip" />} />
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter>
  )
}

const tripsFixture = [
  { id: 't1', name: '沖繩 2026', start_date: futureDate(10), end_date: futureDate(14), owner_email: 'sei@test.com', members },
]

describe('TripListPage', () => {
  it('renders trips and navigates to the trip on tap', async () => {
    mockListMyTrips.mockResolvedValue([
      { id: 't1', name: '沖繩 2026', start_date: futureDate(10), end_date: futureDate(14), owner_email: 'sei@test.com', members },
      { id: 't2', name: '東京跨年', start_date: futureDate(170), end_date: futureDate(173), owner_email: 'other@test.com', members: [] },
    ])

    renderPage()

    expect(await screen.findByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByText('東京跨年')).toBeInTheDocument()

    fireEvent.click(screen.getByText('沖繩 2026'))
    expect(mockNavigate).toHaveBeenCalledWith('/trips/t1')
  })

  it('spells out the countdown, companion count, and groups ended trips', async () => {
    mockListMyTrips.mockResolvedValue([
      { id: 't1', name: '沖繩 2026', start_date: futureDate(10), end_date: futureDate(14), owner_email: 'sei@test.com', members },
      { id: 't2', name: '進行中旅程', start_date: futureDate(-1), end_date: futureDate(1), owner_email: 'sei@test.com', members },
      { id: 't3', name: '舊旅程', start_date: futureDate(-20), end_date: futureDate(-18), owner_email: 'sei@test.com', members },
      { id: 't4', name: '明天旅程', start_date: futureDate(1), end_date: futureDate(2), owner_email: 'sei@test.com', members: [] },
    ])

    renderPage()

    const card = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
    await screen.findByText('沖繩 2026')
    expect(card('沖繩 2026')).toHaveTextContent(/出發倒數\s*10 天/)
    expect(card('進行中旅程')).toHaveTextContent(/旅行中\s*第 2 天/)
    expect(card('明天旅程')).toHaveTextContent(/出發倒數\s*明天/)
    expect(card('舊旅程')).not.toHaveTextContent(/出發倒數|旅行中/)
    expect(screen.getByText('已結束')).toBeInTheDocument()
    expect(screen.getAllByText('2 位旅伴')).toHaveLength(2) // ended trips hide companions
  })

  it('shows empty state when there are no trips', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('還沒有旅程')).toBeInTheDocument()
  })

  it('offers a real button in the empty state', async () => {
    mockListMyTrips.mockResolvedValue([])
    renderPage()
    const cta = await screen.findByRole('button', { name: '建立第一個旅程' })
    await userEvent.click(cta)
    expect(screen.getByTestId('new-trip')).toBeInTheDocument()
  })

  it('hides the floating add button while there are no trips', async () => {
    mockListMyTrips.mockResolvedValue([])
    renderPage()
    await screen.findByRole('button', { name: '建立第一個旅程' })
    expect(screen.queryByRole('button', { name: '新增旅程' })).not.toBeInTheDocument()
  })

  it('navigates to /trips/new from the floating create button', async () => {
    mockListMyTrips.mockResolvedValue(tripsFixture)

    renderPage()
    fireEvent.click(await screen.findByLabelText('新增旅程'))

    expect(mockNavigate).toHaveBeenCalledWith('/trips/new')
  })

  it('opens the account sheet from the header avatar button', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()
    fireEvent.click(await screen.findByLabelText('帳號設定'))

    expect(screen.getByLabelText('顯示名稱')).toBeInTheDocument()
    expect(screen.getByText('登出')).toBeInTheDocument()
  })

  it('falls back to cached trips with an error notice when the fetch fails', async () => {
    localStorage.setItem('sb_trips_list', JSON.stringify([
      { id: 't1', name: '快取旅程', start_date: '2026-08-01', end_date: '2026-08-02', owner_email: 'x@test.com' },
    ]))
    mockListMyTrips.mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByText('快取旅程')).toBeInTheDocument()
    expect(screen.getByText(/^2026\/8\/1 \(六\) – 8\/2 \(日\)/)).toBeInTheDocument()
    expect(screen.getByText('無法載入旅程列表,請檢查網路連線')).toBeInTheDocument()
  })

  it('shows an error notice without the empty state when the fetch fails and there is no cache', async () => {
    mockListMyTrips.mockRejectedValue(new Error('offline'))

    renderPage()

    expect(await screen.findByText('無法載入旅程列表,請檢查網路連線')).toBeInTheDocument()
    expect(screen.queryByText('還沒有旅程')).not.toBeInTheDocument()
  })
})
