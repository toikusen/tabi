import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchForecast, forecastRange, searchPlaces, weatherEmoji } from '../../lib/weather'

const NOW = new Date('2026-09-17T10:00:00')

const mockFetch = (body: unknown, ok = true) => {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('forecastRange', () => {
  it('clamps a trip that starts before the forecast does', () => {
    expect(forecastRange('2026-09-10', '2026-09-19', NOW)).toEqual({
      start: '2026-09-17',
      end: '2026-09-19',
    })
  })

  it('clamps a trip that runs past the 16-day horizon', () => {
    expect(forecastRange('2026-09-20', '2026-10-05', NOW)).toEqual({
      start: '2026-09-20',
      end: '2026-10-02',
    })
  })

  it('returns null for a trip beyond the horizon', () => {
    expect(forecastRange('2027-03-01', '2027-03-05', NOW)).toBeNull()
  })

  it('returns null for a trip that has already ended', () => {
    expect(forecastRange('2026-08-01', '2026-08-05', NOW)).toBeNull()
  })

  it('keeps a trip that sits wholly inside the window', () => {
    expect(forecastRange('2026-09-18', '2026-09-21', NOW)).toEqual({
      start: '2026-09-18',
      end: '2026-09-21',
    })
  })
})

describe('fetchForecast', () => {
  it('keys the daily arrays by date and rounds the temperatures', async () => {
    mockFetch({
      daily: {
        time: ['2026-09-18', '2026-09-19'],
        weather_code: [53, 1],
        temperature_2m_max: [30.3, 29.4],
        temperature_2m_min: [25.6, 25.8],
      },
    })

    expect(await fetchForecast(26.2, 127.7, '2026-09-18', '2026-09-19')).toEqual({
      '2026-09-18': { code: 53, max: 30, min: 26 },
      '2026-09-19': { code: 1, max: 29, min: 26 },
    })
  })

  it('drops a day the model has no value for rather than calling it 0°', async () => {
    mockFetch({
      daily: {
        time: ['2026-09-18', '2026-09-19'],
        weather_code: [53, null],
        temperature_2m_max: [30.3, null],
        temperature_2m_min: [25.6, null],
      },
    })

    expect(await fetchForecast(26.2, 127.7, '2026-09-18', '2026-09-19')).toEqual({
      '2026-09-18': { code: 53, max: 30, min: 26 },
    })
  })

  it('asks only for the requested range', async () => {
    const fetchSpy = mockFetch({ daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [] } })
    await fetchForecast(26.2, 127.7, '2026-09-18', '2026-09-19')

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('start_date=2026-09-18')
    expect(url).toContain('end_date=2026-09-19')
    expect(url).toContain('latitude=26.2')
  })

  it('is empty rather than throwing when the request fails', async () => {
    mockFetch({}, false)
    expect(await fetchForecast(26.2, 127.7, '2026-09-18', '2026-09-19')).toEqual({})

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await fetchForecast(26.2, 127.7, '2026-09-18', '2026-09-19')).toEqual({})
  })
})

describe('searchPlaces', () => {
  it('flattens results to name, coordinates and region', async () => {
    mockFetch({
      results: [
        { name: '那霸市', latitude: 26.213, longitude: 127.678, country: '日本', admin1: '沖縄県' },
      ],
    })

    expect(await searchPlaces('那霸市')).toEqual([
      { name: '那霸市', lat: 26.213, lon: 127.678, region: '日本 · 沖縄県' },
    ])
  })

  it('does not call the API for an empty query', async () => {
    const fetchSpy = mockFetch({})
    expect(await searchPlaces('   ')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('is empty for a name the index does not carry', async () => {
    mockFetch({ generationtime_ms: 0.1 })
    expect(await searchPlaces('那霸')).toEqual([])
  })
})

describe('weatherEmoji', () => {
  it('maps each WMO band to a glyph', () => {
    expect(weatherEmoji(0)).toBe('☀️')
    expect(weatherEmoji(2)).toBe('🌤️')
    expect(weatherEmoji(3)).toBe('☁️')
    expect(weatherEmoji(45)).toBe('🌫️')
    expect(weatherEmoji(53)).toBe('🌦️')
    expect(weatherEmoji(65)).toBe('🌧️')
    expect(weatherEmoji(75)).toBe('🌨️')
    expect(weatherEmoji(81)).toBe('🌧️')
    expect(weatherEmoji(95)).toBe('⛈️')
  })
})
