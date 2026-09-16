import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
const mockDeleteTrip = vi.fn()
const mockCopyTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: () => mockUseTrip() }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'owner@test.com', user_metadata: {} } }),
}))
vi.mock('../../lib/db', () => ({
  updateTrip: vi.fn(async () => ({ ok: true })),
  updateTripDates: vi.fn(async () => ({ ok: true })),
  deleteTrip: (...args: unknown[]) => mockDeleteTrip(...args),
  removeMember: vi.fn(async () => true),
  copyTrip: (...args: unknown[]) => mockCopyTrip(...args),
}))
vi.mock('../../components/MembersSection', () => ({ MembersSection: () => null }))

import { SettingsPage } from '../../pages/SettingsPage'

const trip = {
  id: 't1', name: '沖繩四日遊', owner_email: 'owner@test.com',
  members: [], start_date: '2026-10-12', end_date: '2026-10-15',
}

function renderPage() {
  mockUseTrip.mockReturnValue({ trip, days: [], loading: false })
  return render(
    <MemoryRouter initialEntries={['/trips/t1/settings']}>
      <Routes>
        <Route path="/trips/:tripId/settings" element={<SettingsPage />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
        <Route path="/trips/:tripId" element={<div data-testid="trip-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('carries 重要資訊 as a settings section, off the timeline', () => {
    renderPage()
    expect(screen.getByLabelText('重要資訊')).toBeInTheDocument()
  })
})

describe('SettingsPage delete flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the trip name in a ConfirmSheet instead of window.prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))

    expect(promptSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('請輸入旅程名稱以確認')).toBeInTheDocument()
  })

  it('only deletes once the typed name matches', async () => {
    mockDeleteTrip.mockResolvedValue(true)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))
    const input = screen.getByLabelText('請輸入旅程名稱以確認')
    const confirm = screen.getAllByRole('button', { name: '刪除旅程' })
      .find(b => b.closest('[role="dialog"]'))!

    await userEvent.type(input, '沖繩')
    expect(confirm).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, '沖繩四日遊')
    await userEvent.click(confirm)

    expect(mockDeleteTrip).toHaveBeenCalledWith('t1')
  })
})

describe('SettingsPage copy trip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('copies onto a new start date and opens the copy', async () => {
    mockCopyTrip.mockResolvedValue('t2')
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '複製成新的旅程' }))
    // Seeded from the source so the copy is never nameless
    expect(screen.getByLabelText('新旅程名稱')).toHaveValue('沖繩四日遊 複本')

    const start = screen.getByLabelText('出發日期')
    await userEvent.clear(start)
    await userEvent.type(start, '2027-05-01')
    await userEvent.click(screen.getByRole('button', { name: '複製' }))

    expect(mockCopyTrip).toHaveBeenCalledWith('t1', '沖繩四日遊 複本', '2027-05-01')
    expect(await screen.findByTestId('trip-page')).toBeInTheDocument()
  })

  it('says the length is kept, so nobody looks for an end date field', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '複製成新的旅程' }))
    // 2026-10-12 – 2026-10-15 inclusive
    const sheet = within(screen.getByRole('dialog'))
    expect(sheet.getByText(/長度一樣是 4 天/)).toBeInTheDocument()
    // Scoped to the sheet: the page behind it edits the trip's own end date
    expect(sheet.queryByLabelText('結束日期')).toBeNull()
  })

  it('stays put and says so when the copy is refused', async () => {
    mockCopyTrip.mockResolvedValue(null)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '複製成新的旅程' }))
    await userEvent.click(screen.getByRole('button', { name: '複製' }))

    expect(mockCopyTrip).toHaveBeenCalled()
    expect(screen.queryByTestId('trip-page')).toBeNull()
  })

  it('will not copy under a blank name', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '複製成新的旅程' }))
    await userEvent.clear(screen.getByLabelText('新旅程名稱'))

    expect(screen.getByRole('button', { name: '複製' })).toBeDisabled()
  })
})
