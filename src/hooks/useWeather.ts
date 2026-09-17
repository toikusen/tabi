import { useEffect, useState } from 'react'
import { fetchForecast, forecastRange, type DayWeather } from '../lib/weather'
import type { Trip } from '../types'

/** Forecasts are refreshed hourly; a reopened app inside the hour reuses the cache. */
const TTL_MS = 60 * 60 * 1000

interface Cached {
  at: number
  days: Record<string, DayWeather>
}

function readCache(key: string): Record<string, DayWeather> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw) as Cached
    return Date.now() - cached.at < TTL_MS ? cached.days : null
  } catch {
    return null
  }
}

/**
 * Daily forecast for a trip's days, keyed 'YYYY-MM-DD'.
 *
 * Empty whenever the trip has no coordinates, falls outside the 16-day
 * forecast window, or the request fails — every caller renders nothing for a
 * date it has no entry for, so none of those needs its own branch.
 */
export function useWeather(trip: Trip | null): Record<string, DayWeather> {
  const [days, setDays] = useState<Record<string, DayWeather>>({})
  const { lat, lon, start_date: start, end_date: end } = trip ?? {}

  useEffect(() => {
    if (lat == null || lon == null || !start || !end) {
      setDays({})
      return
    }
    const range = forecastRange(start, end)
    if (!range) {
      setDays({})
      return
    }

    const key = `sb_weather_${lat},${lon}_${range.start}_${range.end}`
    const cached = readCache(key)
    if (cached) {
      setDays(cached)
      return
    }

    let live = true
    fetchForecast(lat, lon, range.start, range.end).then((result) => {
      if (!live) return
      setDays(result)
      // An empty result is a failure, not a forecast: leave it uncached so the
      // next open retries instead of showing nothing for an hour.
      if (!Object.keys(result).length) return
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), days: result } satisfies Cached))
      } catch { /* a full quota costs a refetch, nothing more */ }
    })
    return () => { live = false }
  }, [lat, lon, start, end])

  return days
}
