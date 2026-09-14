// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '../../components/EventCard'
import type { TripEvent } from '../../types'

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

describe('EventCard', () => {
  it('renders title and time range', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('美麗海水族館')).toBeInTheDocument()
    expect(screen.getByText('12:00 – 15:00')).toBeInTheDocument()
  })

  it('renders location when present', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('本部町')).toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<EventCard event={sharedEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('美麗海水族館'))
    expect(onClick).toHaveBeenCalledWith(sharedEvent)
  })
})

const eventWithImage: TripEvent = {
  ...sharedEvent,
  image_url: 'https://cdn.example.com/img.jpg',
  link_urls: ['https://example.com'],
}

describe('EventCard with image', () => {
  it('shows thumbnail img when image_url is present', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/img.jpg')
  })

  it('defers thumbnail loading so a long timeline does not fetch every photo at once', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })

  it('whole card triggers onClick regardless of image', () => {
    const onClick = vi.fn()
    render(<EventCard event={eventWithImage} onClick={onClick} />)
    fireEvent.click(screen.getByRole('img'))
    expect(onClick).toHaveBeenCalledWith(eventWithImage)
  })

  it('is a single tap target exposing the title, not a generic label', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.queryByRole('button', { name: '查看行程' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(sharedEvent.title) })).toBeInTheDocument()
  })
})

describe('EventCard empty time and location link', () => {
  it('omits the time row when both times are empty', () => {
    render(<EventCard event={{ ...sharedEvent, time_start: '', time_end: '' }} onClick={vi.fn()} />)
    expect(screen.queryByText('–', { exact: false })).not.toBeInTheDocument()
  })

  it('shows only the start time when there is no end time', () => {
    render(<EventCard event={{ ...sharedEvent, time_start: '09:00', time_end: '' }} onClick={vi.fn()} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('links the location to Google Maps', () => {
    render(<EventCard event={{ ...sharedEvent, location: '本部町' }} onClick={vi.fn()} />)
    const link = screen.getByRole('link', { name: '導航到 本部町' })
    expect(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('本部町')))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('clicking the maps link does not also trigger the card onClick', () => {
    const onClick = vi.fn()
    render(<EventCard event={{ ...sharedEvent, location: '本部町' }} onClick={onClick} />)
    const link = screen.getByRole('link', { name: '導航到 本部町' })
    fireEvent.click(link)
    expect(link).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('EventCard keyboard activation', () => {
  it('activates onClick when Enter is pressed on the card', () => {
    const onClick = vi.fn()
    render(<EventCard event={sharedEvent} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(sharedEvent.title) }), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledWith(sharedEvent)
  })

  it('activates onClick when Space is pressed on the card', () => {
    const onClick = vi.fn()
    render(<EventCard event={sharedEvent} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(sharedEvent.title) }), { key: ' ' })
    expect(onClick).toHaveBeenCalledWith(sharedEvent)
  })
})
