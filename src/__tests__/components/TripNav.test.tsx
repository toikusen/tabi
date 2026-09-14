import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripNav } from '../../components/TripNav'

const handlers = () => ({ onToday: vi.fn(), onTop: vi.fn(), onOverview: vi.fn() })

describe('TripNav', () => {
  it('offers 今天, 行程 and 總覽 in that order', () => {
    render(<TripNav {...handlers()} active="today" />)
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['今天', '行程', '總覽'])
  })

  it('no longer exposes a settings tab', () => {
    render(<TripNav {...handlers()} active="today" />)
    expect(screen.queryByRole('button', { name: '設定' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '旅伴' })).not.toBeInTheDocument()
  })

  it('sends each tab to its own handler', async () => {
    const h = handlers()
    render(<TripNav {...h} active="itinerary" />)
    await userEvent.click(screen.getByRole('button', { name: '今天' }))
    await userEvent.click(screen.getByRole('button', { name: '行程' }))
    await userEvent.click(screen.getByRole('button', { name: '總覽' }))
    expect(h.onToday).toHaveBeenCalledOnce()
    expect(h.onTop).toHaveBeenCalledOnce()
    expect(h.onOverview).toHaveBeenCalledOnce()
  })

  it('marks 總覽 as the current page on the overview', () => {
    render(<TripNav {...handlers()} active="overview" />)
    expect(screen.getByRole('button', { name: '總覽' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '行程' })).not.toHaveAttribute('aria-current')
  })

  it('disables 今天 when the trip is not under way', () => {
    render(<TripNav {...handlers()} active="itinerary" todayDisabled />)
    expect(screen.getByRole('button', { name: '今天' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '行程' })).toBeEnabled()
  })
})
