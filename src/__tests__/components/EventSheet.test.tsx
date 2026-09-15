// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { EventSheet } from '../../components/EventSheet'
import { createEvent, updateEvent, deleteEvent, moveEvent } from '../../lib/db'
import { uploadEventImage } from '../../lib/storage'
import { compressImage } from '../../lib/image'
import { toast } from '../../lib/toast'
import type { TripEvent } from '../../types'

vi.mock('../../lib/db', () => ({
  createEvent: vi.fn().mockResolvedValue('new-id'),
  updateEvent: vi.fn().mockResolvedValue({ ok: true }),
  deleteEvent: vi.fn().mockResolvedValue({ ok: true }),
  moveEvent: vi.fn().mockResolvedValue({ ok: true }),
  reorderEvents: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../../lib/storage', () => ({
  uploadEventImage: vi.fn().mockResolvedValue('https://cdn.example.com/new.jpg'),
}))

vi.mock('../../lib/image', () => ({ compressImage: vi.fn() }))

vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

const sharedEvent: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '美麗海水族館',
  time_start: '12:00',
  time_end: '15:00',
  location: '本部町',
  notes: '',
  sort_order: 0,
}

describe('EventSheet', () => {
  it('renders nothing when open=false', () => {
    render(
      <EventSheet open={false} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.queryByText('共同行程')).toBeNull()
  })

  it('shows create title and empty form when open=true with no event', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('新增行程')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('行程名稱')).toBeInTheDocument()
  })

  it('shows edit title and pre-fills fields from existing event', () => {
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByText('編輯行程')).toBeInTheDocument()
    expect(screen.getByDisplayValue('美麗海水族館')).toBeInTheDocument()
  })

  it('disables save and shows a hint when the title is empty', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('請輸入行程名稱')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('行程名稱'), { target: { value: '首里城' } })
    expect(screen.getByText('儲存')).toBeEnabled()
    expect(screen.queryByText('請輸入行程名稱')).toBeNull()
  })

  it('fills times from a quick preset pill', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('早上'))
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument()
  })

  const members = [
    { email: 'a@test.com', display_name: 'Alice', avatar_url: '' },
    { email: 'b@test.com', display_name: 'Bob', avatar_url: '' },
  ]
  const forkEvent: TripEvent = {
    ...sharedEvent,
    type: 'fork',
    title: '',
    fork_items: [
      { emails: ['a@test.com'], others: false, title: '水族館', location: '', notes: '' },
      { emails: [], others: true, title: '國際通', location: '', notes: '' },
    ],
  }
  const groupOf = (n: number) => screen.getByRole('group', { name: `第 ${n} 組成員` })
  const toggle = (n: number, name: string) => within(groupOf(n)).getByRole('button', { name })

  it('offers every member and 其他人 as toggles in each fork group', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))
    for (const n of [1, 2]) {
      expect(within(groupOf(n)).getAllByRole('button').map((b) => b.textContent)).toEqual(['Alice', 'Bob', '其他人'])
    }
  })

  it('pre-selects a saved group\'s members and 其他人', () => {
    render(
      <EventSheet open={true} event={forkEvent} dayId="d1" tripId="t1" events={[forkEvent]} members={members} onClose={() => {}} />
    )
    expect(toggle(1, 'Alice')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle(1, 'Bob')).toHaveAttribute('aria-pressed', 'false')
    expect(toggle(2, '其他人')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps a member, and 其他人, to one group at a time', () => {
    render(
      <EventSheet open={true} event={forkEvent} dayId="d1" tripId="t1" events={[forkEvent]} members={members} onClose={() => {}} />
    )
    // Alice is taken by group 1, 其他人 by group 2
    expect(toggle(2, 'Alice')).toBeDisabled()
    expect(toggle(1, '其他人')).toBeDisabled()
    expect(toggle(2, 'Bob')).toBeEnabled()
  })

  it('saves each group\'s members by email', async () => {
    render(
      <EventSheet open={true} event={forkEvent} dayId="d1" tripId="t1" events={[forkEvent]} members={members} onClose={() => {}} />
    )
    fireEvent.click(toggle(2, 'Bob'))
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({
      fork_items: [
        expect.objectContaining({ emails: ['a@test.com'], others: false, title: '水族館' }),
        expect.objectContaining({ emails: ['b@test.com'], others: true, title: '國際通' }),
      ],
    })))
  })

  it('adds a third fork group with ＋ 新增一組', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))
    fireEvent.click(screen.getByText('＋ 新增一組'))
    expect(groupOf(3)).toBeInTheDocument()

    // removable back down to two
    fireEvent.click(screen.getByLabelText('移除第 3 組'))
    expect(screen.queryByRole('group', { name: '第 3 組成員' })).toBeNull()
  })

  it('confirms deletion through ConfirmSheet, not window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('刪除'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(deleteEvent).not.toHaveBeenCalled()
    expect(screen.getByText('確定刪除這個行程?')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows image picker area', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('新增圖片')).toBeInTheDocument()
  })

  it('shows link URL input', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()
  })

  it('pre-fills link_url from existing event', () => {
    const eventWithLink = {
      ...sharedEvent,
      link_url: 'https://oki-park.jp',
    }
    render(
      <EventSheet open={true} event={eventWithLink} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByDisplayValue('https://oki-park.jp')).toBeInTheDocument()
  })

  it('shows existing image preview thumbnail', () => {
    const eventWithImage = {
      ...sharedEvent,
      image_url: 'https://cdn.example.com/existing.jpg',
    }
    render(
      <EventSheet open={true} event={eventWithImage} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/existing.jpg')
  })

  it('blocks saving a fork event with an empty group', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('每一組都要選人和填活動')).toBeInTheDocument()
  })

  it('allows saving once every group has someone and an activity', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    fireEvent.click(toggle(1, 'Alice'))
    fireEvent.change(screen.getByLabelText('第 1 組活動'), { target: { value: '潛水' } })
    fireEvent.click(toggle(2, '其他人'))
    fireEvent.change(screen.getByLabelText('第 2 組活動'), { target: { value: '購物' } })

    expect(screen.getByText('儲存')).toBeEnabled()
  })

  it('keeps the sheet open and toasts when updateEvent fails', async () => {
    vi.mocked(updateEvent).mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('儲存'))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('儲存失敗,請再試一次'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the sheet open and toasts when deleteEvent fails', async () => {
    vi.mocked(deleteEvent).mockResolvedValueOnce({ ok: false, error: 'boom' })
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={onClose} />
    )
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    const confirmButtons = screen.getAllByRole('button', { name: '刪除' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(toast).toHaveBeenCalledWith('刪除失敗,請再試一次'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only activity as empty', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    // Group 1's activity is whitespace-only; everything else is filled in.
    fireEvent.click(toggle(1, 'Alice'))
    fireEvent.change(screen.getByLabelText('第 1 組活動'), { target: { value: '   ' } })
    fireEvent.click(toggle(2, 'Bob'))
    fireEvent.change(screen.getByLabelText('第 2 組活動'), { target: { value: '購物' } })

    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('每一組都要選人和填活動')).toBeInTheDocument()
  })
})

describe('EventSheet day picker', () => {
  const days = [
    { id: 'd1', date: '2026-10-12', label: '抵達', sort_order: 0 },
    { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 },
  ]

  it('is offered only when editing an existing event', () => {
    const { rerender } = render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    expect(screen.queryByLabelText('日期')).toBeNull()

    rerender(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    expect(screen.getByLabelText('日期')).toHaveValue('d1')
  })

  it('moves the event when the day changes, and leaves it alone when it does not', async () => {
    const { unmount } = render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(updateEvent).toHaveBeenCalled())
    expect(moveEvent).not.toHaveBeenCalled()
    unmount()

    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: 'd2' } })
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(moveEvent).toHaveBeenCalledWith('t1', 'e1', 'd2'))
  })

  it('sends the event back to the wishlist when no day is picked', async () => {
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '' } })
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(moveEvent).toHaveBeenCalledWith('t1', 'e1', null))
  })

  it('creates straight into the wishlist when opened with no day', async () => {
    render(
      <EventSheet open={true} event={null} dayId={null} tripId="t1" events={[]} days={days} onClose={() => {}} />
    )
    fireEvent.change(screen.getByPlaceholderText('行程名稱'), { target: { value: '古宇利島' } })
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith('t1', null, expect.objectContaining({ title: '古宇利島' }))
    )
  })
})

describe('EventSheet image picking', () => {
  beforeEach(() => vi.clearAllMocks())

  const pick = (container: HTMLElement, file: File) => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
  }

  const original = () =>
    new File([new Uint8Array(4 * 1024 * 1024)], 'IMG_0001.jpeg', { type: 'image/jpeg' })

  it('uploads the shrunk photo rather than the original the user picked', async () => {
    const shrunk = new File([new Uint8Array(200 * 1024)], 'IMG_0001.jpg', { type: 'image/jpeg' })
    vi.mocked(compressImage).mockResolvedValue(shrunk)
    const picked = original()

    const { container } = render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    pick(container, picked)

    await waitFor(() => expect(compressImage).toHaveBeenCalledWith(picked))
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(uploadEventImage).toHaveBeenCalledWith('t1', 'e1', shrunk))
  })

  it('rejects a photo that is still over 5MB after shrinking', async () => {
    const stillHuge = new File([new Uint8Array(6 * 1024 * 1024)], 'IMG_0001.jpg', { type: 'image/jpeg' })
    vi.mocked(compressImage).mockResolvedValue(stillHuge)

    const { container } = render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    pick(container, original())

    await waitFor(() => expect(toast).toHaveBeenCalledWith('圖片不能超過 5MB'))
    fireEvent.click(screen.getByText('儲存'))
    await waitFor(() => expect(updateEvent).toHaveBeenCalled())
    expect(uploadEventImage).not.toHaveBeenCalled()
  })
})
