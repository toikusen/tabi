import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../lib/weather', () => ({ searchPlaces: vi.fn() }))

import { DestinationPicker } from '../../components/DestinationPicker'
import { searchPlaces, type Place } from '../../lib/weather'

const naha: Place = { name: '那霸市', lat: 26.213, lon: 127.678, region: '日本 · 沖縄県' }

describe('DestinationPicker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands back the picked place with its coordinates', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([naha])
    const onPick = vi.fn()
    render(<DestinationPicker value="" onPick={onPick} />)

    fireEvent.change(screen.getByLabelText('目的地'), { target: { value: '那霸市' } })

    fireEvent.click(await screen.findByText('那霸市'))
    expect(onPick).toHaveBeenCalledWith(naha)
  })

  it('does not search a single character', async () => {
    render(<DestinationPicker value="" onPick={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('目的地'), { target: { value: '東' } })

    await new Promise((r) => setTimeout(r, 400))
    expect(searchPlaces).not.toHaveBeenCalled()
  })

  it('searches once for a name typed in one go, not once per keystroke', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([naha])
    render(<DestinationPicker value="" onPick={vi.fn()} />)
    const input = screen.getByLabelText('目的地')

    fireEvent.change(input, { target: { value: '那霸' } })
    fireEvent.change(input, { target: { value: '那霸市' } })

    await waitFor(() => expect(searchPlaces).toHaveBeenCalledOnce())
    expect(searchPlaces).toHaveBeenCalledWith('那霸市')
  })

  it('says so when the index carries no such name', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([])
    render(<DestinationPicker value="" onPick={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('目的地'), { target: { value: '那霸' } })

    expect(await screen.findByText(/找不到這個地點/)).toBeInTheDocument()
  })

  it('shows a set destination with a way to clear it', () => {
    const onPick = vi.fn()
    render(<DestinationPicker value="那霸市" onPick={onPick} />)

    expect(screen.queryByLabelText('目的地')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(onPick).toHaveBeenCalledWith(null)
  })
})
