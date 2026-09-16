// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSetTripShare = vi.fn()
vi.mock('../../lib/db', () => ({
  setTripShare: (...args: unknown[]) => mockSetTripShare(...args),
}))
vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

import { ShareLinkSection } from '../../components/ShareLinkSection'
import { toast } from '../../lib/toast'
import type { Trip } from '../../types'

const trip = (share_token: string | null = null): Trip => ({
  id: 't1', name: '沖繩', owner_email: 'owner@test.com', members: [],
  start_date: '2031-02-01', end_date: '2031-02-02', notes: '', share_token,
})

describe('ShareLinkSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetTripShare.mockResolvedValue({ ok: true, token: 'new-token' })
  })

  describe('as the owner', () => {
    it('offers to build a link, and warns what it exposes before it exists', () => {
      render(<ShareLinkSection trip={trip()} isOwner />)
      expect(screen.getByRole('button', { name: '建立唯讀連結' })).toBeInTheDocument()
      expect(screen.getByText(/拿到連結的人都看得到,包含重要資訊/)).toBeInTheDocument()
    })

    it('asks the server to turn sharing on', async () => {
      render(<ShareLinkSection trip={trip()} isOwner />)
      await userEvent.click(screen.getByRole('button', { name: '建立唯讀連結' }))
      expect(mockSetTripShare).toHaveBeenCalledWith('t1', true)
    })

    it('shows the full link once there is a token', () => {
      render(<ShareLinkSection trip={trip('abc')} isOwner />)
      expect(screen.getByLabelText('唯讀連結')).toHaveValue(`${window.location.origin}/s/abc`)
    })

    it('confirms before regenerating, since it kills the link already handed out', async () => {
      render(<ShareLinkSection trip={trip('abc')} isOwner />)
      await userEvent.click(screen.getByRole('button', { name: '重新產生' }))

      expect(screen.getByText(/舊的連結會立刻失效/)).toBeInTheDocument()
      expect(mockSetTripShare).not.toHaveBeenCalled()

      // Scoped to the sheet: the section behind it has a button of the same name
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '重新產生' }))
      expect(mockSetTripShare).toHaveBeenCalledWith('t1', true)
    })

    it('confirms before closing sharing, then turns it off', async () => {
      render(<ShareLinkSection trip={trip('abc')} isOwner />)
      await userEvent.click(screen.getByRole('button', { name: '關閉分享' }))
      expect(screen.getByText(/連結會立刻失效/)).toBeInTheDocument()

      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '關閉分享' }))
      expect(mockSetTripShare).toHaveBeenCalledWith('t1', false)
    })

    it('says so when the server refuses instead of implying a link changed', async () => {
      mockSetTripShare.mockResolvedValue({ ok: false })
      render(<ShareLinkSection trip={trip()} isOwner />)

      await userEvent.click(screen.getByRole('button', { name: '建立唯讀連結' }))
      expect(toast).toHaveBeenCalledWith('建立連結失敗,請再試一次')
    })
  })

  describe('as a member who is not the owner', () => {
    it('can copy the link but cannot change or kill it', () => {
      render(<ShareLinkSection trip={trip('abc')} isOwner={false} />)

      expect(screen.getByLabelText('唯讀連結')).toHaveValue(`${window.location.origin}/s/abc`)
      expect(screen.getByRole('button', { name: '複製唯讀連結' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '重新產生' })).toBeNull()
      expect(screen.queryByRole('button', { name: '關閉分享' })).toBeNull()
    })

    it('is told there is no link rather than offered a button that would fail', () => {
      render(<ShareLinkSection trip={trip()} isOwner={false} />)
      expect(screen.getByText('主揪還沒建立唯讀連結。')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '建立唯讀連結' })).toBeNull()
    })
  })
})
