// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventDetailSheet } from '../../components/EventDetailSheet'
import type { TripEvent } from '../../types'

const event: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '首里城',
  time_start: '09:00',
  time_end: '11:00',
  location: '那霸市',
  notes: '',
  sort_order: 0,
  image_url: 'https://cdn.example.com/shurijo.jpg',
  link_urls: ['https://oki-park.jp/shurijo/'],
}

describe('EventDetailSheet', () => {
  it('names each fork group by its members, and the rest as 其他人', () => {
    const fork: TripEvent = {
      ...event,
      type: 'fork',
      title: '',
      image_url: null,
      fork_items: [
        { emails: ['sei@test.com'], others: false, title: '跑場', location: '', notes: '' },
        { emails: [], others: true, title: '首里城', location: '', notes: '' },
      ],
    }
    const members = [{ email: 'sei@test.com', display_name: '成', avatar_url: '' }]
    render(<EventDetailSheet members={members} open={true} event={fork} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('成')).toBeInTheDocument()
    expect(screen.getByText('其他人')).toBeInTheDocument()
  })

  it('renders nothing when open=false', () => {
    render(<EventDetailSheet members={[]} open={false} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows image with correct src', () => {
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/shurijo.jpg')
  })

  it('shows event title and location', () => {
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('首里城')).toBeInTheDocument()
    expect(screen.getByText('那霸市')).toBeInTheDocument()
  })

  it('shows a link button labelled with the host', () => {
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('link', { name: '前往 oki-park.jp' })).toHaveAttribute('href', 'https://oki-park.jp/shurijo/')
  })

  it('shows one button per link, without the www prefix', () => {
    const twoLinks = { ...event, link_urls: ['https://oki-park.jp/shurijo/', 'https://www.tabelog.com/x'] }
    render(<EventDetailSheet members={[]} open={true} event={twoLinks} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('link', { name: '前往 oki-park.jp' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往 tabelog.com' })).toHaveAttribute('href', 'https://www.tabelog.com/x')
  })

  it('hides link buttons when there are no links', () => {
    const noLink = { ...event, link_urls: [] }
    render(<EventDetailSheet members={[]} open={true} event={noLink} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByText(/^前往/)).toBeNull()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('編輯行程'))
    expect(onEdit).toHaveBeenCalledWith(event)
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={onClose} onEdit={() => {}} />)
    fireEvent.click(screen.getByTestId('detail-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('links the location to Google Maps', () => {
    render(<EventDetailSheet members={[]} open={true} event={{ ...event, location: '本部町' }} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('link', { name: '導航到 本部町' })).toBeInTheDocument()
  })

  it('shows only the start time when there is no end time', () => {
    render(<EventDetailSheet members={[]} open={true} event={{ ...event, time_start: '09:00', time_end: '' }} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.queryByText('–', { exact: false })).not.toBeInTheDocument()
  })

  it('hides the edit button when hideEdit is set', () => {
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={() => {}} hideEdit />)
    expect(screen.queryByText('編輯行程')).not.toBeInTheDocument()
  })
})

describe('EventDetailSheet image', () => {
  it('opens an uncropped full-screen view when the photo is tapped', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={onClose} onEdit={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '放大檢視 首里城' }))

    const zoomed = screen.getAllByRole('img').find(i => i.className.includes('object-contain'))
    expect(zoomed).toHaveAttribute('src', 'https://cdn.example.com/shurijo.jpg')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes the full-screen view without closing the sheet', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={onClose} onEdit={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '放大檢視 首里城' }))
    fireEvent.click(screen.getByRole('button', { name: '關閉大圖' }))

    expect(screen.queryByRole('button', { name: '關閉大圖' })).not.toBeInTheDocument()
    expect(screen.getByText('編輯行程')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('drops the photo area when the image fails to load', () => {
    render(<EventDetailSheet members={[]} open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: '放大檢視 首里城' })).not.toBeInTheDocument()
  })
})
