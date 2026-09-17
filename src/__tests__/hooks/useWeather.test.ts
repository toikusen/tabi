import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWeather } from '../../hooks/useWeather'
import { fetchForecast } from '../../lib/weather'
import type { Trip } from '../../types'

vi.mock('../../lib/weather', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/weather')>()),
  fetchForecast: vi.fn(),
}))

const forecast = { '2026-09-18': { code: 1, max: 29, min: 25 } }

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: '沖繩',
  owner_email: 'sei@test.com',
  members: [],
  start_date: '2026-09-18',
  end_date: '2026-09-20',
  notes: '',
  destination: '那霸市',
  lat: 26.213,
  lon: 127.678,
  ...over,
})

describe('useWeather', () => {
  beforeEach(() => {
    // shouldAdvanceTime keeps waitFor's own polling alive under a frozen clock
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-17T10:00:00'))
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(fetchForecast).mockResolvedValue(forecast)
  })
  afterEach(() => vi.useRealTimers())

  it('fetches the forecast for a trip inside the window', async () => {
    const { result } = renderHook(() => useWeather(trip()))
    await waitFor(() => expect(result.current).toEqual(forecast))
    expect(fetchForecast).toHaveBeenCalledWith(26.213, 127.678, '2026-09-18', '2026-09-20')
  })

  it('asks for nothing when the trip has no destination coordinates', async () => {
    const { result } = renderHook(() => useWeather(trip({ lat: null, lon: null })))
    expect(result.current).toEqual({})
    expect(fetchForecast).not.toHaveBeenCalled()
  })

  it('asks for nothing when the trip is beyond the forecast horizon', () => {
    renderHook(() => useWeather(trip({ start_date: '2027-03-01', end_date: '2027-03-05' })))
    expect(fetchForecast).not.toHaveBeenCalled()
  })

  it('reuses a cached forecast on the next mount', async () => {
    const { result, unmount } = renderHook(() => useWeather(trip()))
    await waitFor(() => expect(result.current).toEqual(forecast))
    unmount()

    const second = renderHook(() => useWeather(trip()))
    expect(second.result.current).toEqual(forecast)
    expect(fetchForecast).toHaveBeenCalledOnce()
  })

  it('refetches rather than caching a failed lookup', async () => {
    vi.mocked(fetchForecast).mockResolvedValue({})
    const first = renderHook(() => useWeather(trip()))
    await waitFor(() => expect(fetchForecast).toHaveBeenCalledOnce())
    first.unmount()

    vi.mocked(fetchForecast).mockResolvedValue(forecast)
    const second = renderHook(() => useWeather(trip()))
    await waitFor(() => expect(second.result.current).toEqual(forecast))
    expect(fetchForecast).toHaveBeenCalledTimes(2)
  })
})
