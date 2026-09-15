// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MembersSection } from '../../components/MembersSection'
import { addGuest, mergeGuest, removeMember } from '../../lib/db'

vi.mock('../../lib/db', () => ({
  addGuest: vi.fn().mockResolvedValue('guest:new'),
  mergeGuest: vi.fn().mockResolvedValue(true),
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

  it('lets a member bind a companion only to their own account, since binding renames it', () => {
    render(<MembersSection trip={trip} currentEmail="bro@test.com" />)
    fireEvent.click(screen.getByRole('button', { name: '綁定' }))

    const picker = screen.getByRole('group', { name: '爸爸是哪個帳號' })
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['昱達 bro@test.com'])
    expect(within(picker).getByText(/綁到別人的帳號請找主揪/)).toBeInTheDocument()
  })

  it('lets the owner bind a companion to any account that joined, only once confirmed', async () => {
    const joined = {
      ...trip,
      members: [
        ...trip.members,
        { email: 'guest:mom', display_name: '媽媽', avatar_url: '' },
        { email: 'dad@test.com', display_name: '杜大明', avatar_url: '' },
      ],
    }
    render(<MembersSection trip={joined} currentEmail="owner@test.com" />)
    // Only companions without an account offer 綁定
    const bind = screen.getAllByRole('button', { name: '綁定' })
    expect(bind).toHaveLength(2)
    fireEvent.click(bind[0])

    const picker = screen.getByRole('group', { name: '爸爸是哪個帳號' })
    // Accounts only, never another companion without one
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '昱成 owner@test.com', '昱達 bro@test.com', '杜大明 dad@test.com',
    ])
    fireEvent.click(within(picker).getByRole('button', { name: /杜大明/ }))
    expect(mergeGuest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '確認綁定' }))
    await waitFor(() => expect(mergeGuest).toHaveBeenCalledWith('t1', 'guest:dad', 'dad@test.com'))
  })
})
