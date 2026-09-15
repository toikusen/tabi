import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockCreateTrip = vi.fn()
vi.mock('../../lib/db', () => ({
  createTrip: (...args: unknown[]) => mockCreateTrip(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: { full_name: 'Sei', avatar_url: '' } } }),
}))

import { NewTripPage } from '../../pages/NewTripPage'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <NewTripPage />
    </MemoryRouter>
  )
}

function dateInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'))
}

describe('NewTripPage', () => {
  it('disables the create button until name and dates are filled', () => {
    renderPage()
    expect(screen.getByText('建立旅程')).toBeDisabled()

    // dates are prefilled by default; clear them to exercise the requirement
    const [start, end] = dateInputs()
    fireEvent.change(start, { target: { value: '' } })
    fireEvent.change(end, { target: { value: '' } })

    fireEvent.change(screen.getByPlaceholderText('旅程名稱'), { target: { value: '東京' } })
    expect(screen.getByText('建立旅程')).toBeDisabled()

    fireEvent.change(start, { target: { value: '2026-09-01' } })
    fireEvent.change(end, { target: { value: '2026-09-03' } })
    expect(screen.getByText('建立旅程')).toBeEnabled()
  })

  it('disables the create button when start date is after end date', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('旅程名稱'), { target: { value: '東京' } })
    const [start, end] = dateInputs()
    fireEvent.change(start, { target: { value: '2026-09-05' } })
    fireEvent.change(end, { target: { value: '2026-09-03' } })
    expect(screen.getByText('建立旅程')).toBeDisabled()
  })

  it('creates the trip and navigates to it', async () => {
    mockCreateTrip.mockResolvedValue('new-id')
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('旅程名稱'), { target: { value: '東京' } })
    const [start, end] = dateInputs()
    fireEvent.change(start, { target: { value: '2026-09-01' } })
    fireEvent.change(end, { target: { value: '2026-09-03' } })
    fireEvent.click(screen.getByText('建立旅程'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/trips/new-id', { replace: true }))
    // No email argument: the RPC takes the owner from the caller's own session
    expect(mockCreateTrip).toHaveBeenCalledWith('東京', 'Sei', '', '2026-09-01', '2026-09-03')
  })

  it('shows an error when creation fails', async () => {
    mockCreateTrip.mockRejectedValue(new Error('boom'))
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('旅程名稱'), { target: { value: '東京' } })
    const [start, end] = dateInputs()
    fireEvent.change(start, { target: { value: '2026-09-01' } })
    fireEvent.change(end, { target: { value: '2026-09-03' } })
    fireEvent.click(screen.getByText('建立旅程'))

    expect(await screen.findByText('建立失敗,請再試一次')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('prefills today through today plus two days', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-08T12:00:00'))
      renderPage()
      expect(screen.getByLabelText('開始日期')).toHaveValue('2026-09-08')
      expect(screen.getByLabelText('結束日期')).toHaveValue('2026-09-10')
    } finally {
      vi.useRealTimers()
    }
  })
})
