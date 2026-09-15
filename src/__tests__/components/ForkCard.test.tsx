// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { ForkCard } from '../../components/ForkCard'
import type { TripEvent } from '../../types'

const members = [
  { email: 'sei@test.com', display_name: 'Sei', avatar_url: '' },
  { email: 'ted@test.com', display_name: 'Ted', avatar_url: '' },
]

const forkEvent: TripEvent = {
  id: 'e2',
  type: 'fork',
  title: '',
  time_start: '15:30',
  time_end: '17:30',
  location: '',
  notes: '',
  sort_order: 1,
  fork_items: [
    { emails: ['sei@test.com'], others: false, title: '參加活動', location: '', notes: '' },
    { emails: [], others: true, title: '浦添 PARCO', location: '', notes: '' },
  ],
}

describe('ForkCard', () => {
  it('names each group by its members, and the rest as 其他人', () => {
    render(<ForkCard members={members} event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('Sei')).toBeInTheDocument()
    expect(screen.getByText('其他人')).toBeInTheDocument()
  })

  it('renders both activity titles', () => {
    render(<ForkCard members={members} event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('參加活動')).toBeInTheDocument()
    expect(screen.getByText('浦添 PARCO')).toBeInTheDocument()
  })

  it('shows time range in header', () => {
    render(<ForkCard members={members} event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText(/15:30–17:30/)).toBeInTheDocument()
  })

  it('renders just the label with no separator or dash when both times are blank', () => {
    const noTimeEvent: TripEvent = { ...forkEvent, time_start: '', time_end: '' }
    render(<ForkCard members={members} event={noTimeEvent} onClick={() => {}} />)
    expect(screen.getByText('分頭行動')).toBeInTheDocument()
    expect(screen.queryByText(/–/)).not.toBeInTheDocument()
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<ForkCard members={members} event={forkEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('Sei'))
    expect(onClick).toHaveBeenCalledWith(forkEvent)
  })
})

const forkEventWithLocation: TripEvent = {
  ...forkEvent,
  fork_items: [
    { emails: ['sei@test.com'], others: false, title: '參加活動', location: '本部町', notes: '' },
    { emails: [], others: true, title: '浦添 PARCO', location: '', notes: '' },
  ],
}

describe('ForkCard maps link propagation', () => {
  it('clicking a group maps link does not also trigger the card onClick', () => {
    const onClick = vi.fn()
    render(<ForkCard members={members} event={forkEventWithLocation} onClick={onClick} />)
    const link = screen.getByRole('link', { name: '導航到 本部町' })
    fireEvent.click(link)
    expect(link).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ForkCard keyboard activation', () => {
  it('activates onClick when Enter is pressed on the card', () => {
    const onClick = vi.fn()
    render(<ForkCard members={members} event={forkEvent} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledWith(forkEvent)
  })

  it('activates onClick when Space is pressed on the card', () => {
    const onClick = vi.fn()
    render(<ForkCard members={members} event={forkEvent} onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onClick).toHaveBeenCalledWith(forkEvent)
  })
})

describe('ForkCard layout', () => {
  it('stacks groups in a single column regardless of count', () => {
    const { container } = render(<ForkCard members={members} event={forkEvent} onClick={vi.fn()} />)
    const groups = container.querySelector('[data-testid="fork-groups"]')!
    expect(groups.className).toContain('flex-col')
  })
})
