// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

vi.mock('../pages/PublicTripPage', () => ({ PublicTripPage: () => <div data-testid="public-trip" /> }))
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <div data-testid="login" /> }))
vi.mock('../pages/TripListPage', () => ({ TripListPage: () => <div data-testid="trip-list" /> }))
vi.mock('../pages/TimelinePage', () => ({ TimelinePage: () => null }))
vi.mock('../pages/NewTripPage', () => ({ NewTripPage: () => null }))
vi.mock('../pages/JoinPage', () => ({ JoinPage: () => <div data-testid="join" /> }))
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => null }))
vi.mock('../pages/OverviewPage', () => ({ OverviewPage: () => null }))
vi.mock('../components/Toast', () => ({ Toast: () => null }))

import App from '../App'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )

describe('App routing', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('signed out', () => {
    beforeEach(() => mockUseAuth.mockReturnValue({ user: null, loading: false }))

    it('opens a read-only link without asking anyone to sign in', () => {
      // The whole point: the reader has no account and never will
      renderAt('/s/tok-1')
      expect(screen.getByTestId('public-trip')).toBeInTheDocument()
      expect(screen.queryByTestId('login')).toBeNull()
    })

    it('still sends every other route to the login page', () => {
      renderAt('/trips/t1')
      expect(screen.getByTestId('login')).toBeInTheDocument()
    })

    it('keeps the join link reachable', () => {
      renderAt('/join/t1')
      expect(screen.getByTestId('join')).toBeInTheDocument()
    })
  })

  describe('signed in', () => {
    beforeEach(() =>
      mockUseAuth.mockReturnValue({ user: { email: 'sei@test.com' }, loading: false })
    )

    it('opens a read-only link rather than bouncing it to the trip list', () => {
      renderAt('/s/tok-1')
      expect(screen.getByTestId('public-trip')).toBeInTheDocument()
      expect(screen.queryByTestId('trip-list')).toBeNull()
    })

    it('sends an unknown route back to the trip list', () => {
      renderAt('/nope')
      expect(screen.getByTestId('trip-list')).toBeInTheDocument()
    })
  })
})
