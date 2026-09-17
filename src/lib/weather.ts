import { todayStr } from './dates'

/**
 * Open-Meteo: no API key, no attribution requirement, CORS open to the browser.
 * Two endpoints — one to turn a place name into coordinates (once, when the
 * traveller picks a destination), one for the daily forecast.
 */
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** The forecast reaches 16 days out; asking beyond that is an error, not an empty day. */
export const FORECAST_DAYS = 16

export interface Place {
  name: string
  lat: number
  lon: number
  /** "日本 · 沖縄県" — two places share a name often enough to need it */
  region: string
}

export interface DayWeather {
  /** WMO weather interpretation code */
  code: number
  max: number
  min: number
}

/**
 * Place-name search for the destination picker.
 *
 * The index matches on whole names, so this has to be a picker rather than a
 * blind lookup: 「那霸」finds nothing while 「那霸市」finds Naha. Suggestions
 * let the traveller discover that instead of hitting a dead end.
 */
export async function searchPlaces(query: string, count = 5): Promise<Place[]> {
  const q = query.trim()
  if (!q) return []

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=${count}&language=zh&format=json`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const body = (await res.json()) as {
      results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[]
    }
    return (body.results ?? []).map((r) => ({
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      region: [r.country, r.admin1].filter(Boolean).join(' · '),
    }))
  } catch {
    return []
  }
}

/**
 * Clamps a trip's range to the days a forecast exists for: today through
 * today + 15. Returns null when the trip falls entirely outside it — a trip
 * next spring, or one that ended last month.
 */
export function forecastRange(
  startDate: string,
  endDate: string,
  now = new Date()
): { start: string; end: string } | null {
  const first = todayStr(now)
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + FORECAST_DAYS - 1)
  const last = todayStr(horizon)

  const start = startDate > first ? startDate : first
  const end = endDate < last ? endDate : last
  return start > end ? null : { start, end }
}

/** Daily forecast by date, keyed 'YYYY-MM-DD'. Empty on any failure: weather is a garnish. */
export async function fetchForecast(
  lat: number,
  lon: number,
  start: string,
  end: string
): Promise<Record<string, DayWeather>> {
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    `&timezone=auto&start_date=${start}&end_date=${end}`

  try {
    const res = await fetch(url)
    if (!res.ok) return {}
    const body = (await res.json()) as {
      daily?: {
        time: string[]
        weather_code: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
      }
    }
    const daily = body.daily
    if (!daily) return {}

    const out: Record<string, DayWeather> = {}
    daily.time.forEach((date, i) => {
      const code = daily.weather_code[i]
      const max = daily.temperature_2m_max[i]
      const min = daily.temperature_2m_min[i]
      // A day the model has no value for comes back null, and Math.round(null)
      // is a confident 0°. Skip it: a missing day renders nothing at all.
      if (code == null || max == null || min == null) return
      out[date] = { code, max: Math.round(max), min: Math.round(min) }
    })
    return out
  } catch {
    return {}
  }
}

/**
 * WMO code → one glyph. Grouped by what changes what you pack: clear, cloud,
 * fog, rain, snow, storm. The exact drizzle-versus-shower distinction the code
 * carries is more than a trip planner needs.
 */
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}
