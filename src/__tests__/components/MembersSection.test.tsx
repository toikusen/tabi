// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MembersSection } from '../../components/MembersSection'
import { addGuest, removeMember } from '../../lib/db'

vi.mock('../../lib/db', () => ({
  addGuest: vi.fn().mockResolvedValue('guest:new'),
  removeMember: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

const trip = {
  id: 't1', name: '大阪', owner_email: 'owner@test.com', notes: '',
  start_date: '2026-10-12', end_date: '2026-10-15',
  members: [
    { email: 'owner@test.com', display_name: '昱成', avatar_url: '' },
    { email: 'bro@test.com', display_name: '昱達', avatar_url: '' },
    { email: 'guest:dad', display_name: '爸爸', avatar_url: '' },
  ],
}

describe('MembersSection', () => {
  it('marks a companion without an account as 未加入, with no key shown', () => {
    render(<MembersSection trip={trip} currentEmail="bro@test.com" />)
    expect(screen.getByText('未加入')).toBeInTheDocument()
    expect(screen.queryByText('guest:dad')).toBeNull()
    expect(screen.getByText('旅伴 (3)')).toBeInTheDocument()
  })

  it('lets any member remove a companion without an account, while members stay owner-only', async () => {
    render(<MembersSection trip={trip} currentEmail="bro@test.com" />)
    // Not the owner: the only remove button is 爸爸's
    const remove = screen.getAllByRole('button', { name: '移除' })
    expect(remove).toHaveLength(1)

    fireEvent.click(remove[0])
    fireEvent.click(remove[0])
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('t1', 'guest:dad'))
  })

  it('adds a companion without an account by name', async () => {
    render(<MembersSection trip={trip} currentEmail="bro@test.com" />)
    const input = screen.getByLabelText('沒有帳號的旅伴名字')
    expect(screen.getByRole('button', { name: '＋ 新增' })).toBeDisabled()

    fireEvent.change(input, { target: { value: ' 媽媽 ' } })
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增' }))

    await waitFor(() => expect(addGuest).toHaveBeenCalledWith('t1', '媽媽'))
    await waitFor(() => expect(input).toHaveValue(''))
  })
})
