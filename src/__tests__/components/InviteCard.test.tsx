import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InviteCard } from '../../components/InviteCard'

const trip = (memberCount: number) => ({
  id: 't1', name: '沖繩四日遊', owner_email: 'a@test.com',
  start_date: '2026-10-12', end_date: '2026-10-15',
  members: Array.from({ length: memberCount }, (_, i) => ({
    email: `m${i}@test.com`, display_name: `M${i}`, avatar_url: '',
  })),
})

describe('InviteCard', () => {
  it('prompts to invite while the trip is a party of one', () => {
    render(<InviteCard trip={trip(1)} />)
    expect(screen.getByText('把連結傳給旅伴,一起排行程')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享邀請連結' })).toBeInTheDocument()
  })

  it('disappears once someone else has joined', () => {
    const { container } = render(<InviteCard trip={trip(2)} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps prompting when the only others are companions without an account', () => {
    const solo = trip(1)
    render(<InviteCard trip={{ ...solo, members: [...solo.members, { email: 'guest:dad', display_name: '爸爸', avatar_url: '' }] }} />)
    expect(screen.getByRole('button', { name: '分享邀請連結' })).toBeInTheDocument()
  })
})
