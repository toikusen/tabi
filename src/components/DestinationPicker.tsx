import { useEffect, useRef, useState } from 'react'
import { searchPlaces, type Place } from '../lib/weather'

interface Props {
  /** The destination as last picked; '' when there is none yet. */
  value: string
  /** A picked place, or null when the destination is cleared. */
  onPick: (place: Place | null) => void
}

/**
 * Picks the trip's destination from Open-Meteo's place index, which is what
 * gives the timeline a forecast.
 *
 * A picker rather than a text field because the index matches whole names:
 * 「那霸」finds nothing, 「那霸市」finds Naha. Suggestions make that visible
 * instead of leaving a typed-in destination silently unresolved.
 */
export function DestinationPicker({ value, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)

  // Debounced so a name is searched once it stops being typed, not per keystroke
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const mine = ++seq.current
      const found = await searchPlaces(q)
      // A slower earlier search must not overwrite a later one's results
      if (mine !== seq.current) return
      setResults(found)
      setSearching(false)
    }, 300)
    return () => {
      clearTimeout(timer)
      setSearching(false)
    }
  }, [query])

  const take = (place: Place) => {
    setQuery('')
    setResults([])
    onPick(place)
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-sm text-text-strong">{value}</span>
          <button
            onClick={() => onPick(null)}
            className="shrink-0 text-xs font-semibold text-danger py-2 -my-2"
          >
            清除
          </button>
        </div>
      ) : (
        <>
          <input
            aria-label="目的地"
            className="w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong bg-white"
            placeholder="城市名稱,例:東京、那霸市"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!!results.length && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {results.map((place) => (
                <li key={`${place.lat},${place.lon}`}>
                  <button
                    onClick={() => take(place)}
                    className="w-full text-left bg-bg rounded-[8px] px-3 py-2 active:opacity-70"
                  >
                    <span className="text-sm text-text-strong">{place.name}</span>
                    {place.region && (
                      <span className="ml-1.5 text-[11px] text-text-label">{place.region}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && !results.length && query.trim().length >= 2 && (
            <p className="text-[11px] text-text-label mt-1.5">
              找不到這個地點,換城市名稱或日文、英文名稱試試。
            </p>
          )}
        </>
      )}
    </div>
  )
}
