// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

import { itineraryText, shareItinerary } from '../../lib/share'
import { toast } from '../../lib/toast'
import type { Day, TripEvent } from '../../types'

const trip = {
  name: '沖繩四天三夜',
  start_date: '2026-10-12',
  end_date: '2026-10-15',
  notes: '',
  members: [
    { email: 'sei@test.com', display_name: 'Sei', avatar_url: '' },
    { email: 'ann@test.com', display_name: 'Ann', avatar_url: '' },
  ],
}

const days: Day[] = [
  { id: 'd1', date: '2026-10-12', label: '抵達', sort_order: 0 },
  { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 },
]

const event = (over: Partial<TripEvent> = {}): TripEvent => ({
  id: 'e1', type: 'shared', title: '美麗海水族館', time_start: '09:00', time_end: '11:00',
  location: '本部町', notes: '', sort_order: 0, ...over,
})

describe('itineraryText', () => {
  it('lists every day with its events, times, places and notes', () => {
    const text = itineraryText(trip, days, {
      d1: [event(), event({ id: 'e2', title: '晚餐', time_start: '18:00', time_end: '', location: '', notes: '訂位 6 人\n靠窗' })],
    })

    expect(text).toContain('沖繩四天三夜')
    expect(text).toContain('── 10/12 (一) 抵達')
    expect(text).toContain('09:00–11:00 美麗海水族館')
    expect(text).toContain('  地點:本部町')
    expect(text).toContain('18:00 晚餐')
    expect(text).toContain('  訂位 6 人')
    expect(text).toContain('  靠窗')
    // A day with no events still appears, so nobody assumes it was forgotten.
    expect(text).toContain('── 10/13 (二)')
    expect(text).toContain('(尚未安排)')
  })

  it('includes the trip memo only when it has content', () => {
    const byDay = { d1: [event()] }
    expect(itineraryText(trip, days, byDay)).not.toContain('【重要資訊】')
    expect(itineraryText({ ...trip, notes: 'BR116 07:35' }, days, byDay))
      .toContain('【重要資訊】\nBR116 07:35')
  })

  it('expands a fork event into one line per group', () => {
    const text = itineraryText(trip, days, {
      d1: [event({
        type: 'fork', title: '', location: '',
        fork_items: [
          { emails: ['sei@test.com'], others: false, title: '逛街', location: '國際通', notes: '' },
          { emails: ['ann@test.com'], others: true, title: '潛水', location: '', notes: '' },
        ],
      })],
    })
    expect(text).toContain('09:00–11:00 分頭行動')
    expect(text).toContain('  ・Sei:逛街(國際通)')
    expect(text).toContain('  ・Ann、其他人:潛水')
  })
})

describe('shareItinerary', () => {
  const nav = navigator as unknown as Record<string, unknown>

  beforeEach(() => {
    vi.mocked(toast).mockClear()
  })

  afterEach(() => {
    delete nav.share
    delete nav.clipboard
  })

  it('uses the native share sheet when there is one', async () => {
    const share = vi.fn(async () => {})
    nav.share = share
    await shareItinerary('沖繩', '內容')
    expect(share).toHaveBeenCalledWith({ title: '沖繩', text: '內容' })
    expect(toast).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard when there is no share sheet', async () => {
    const writeText = vi.fn(async () => {})
    nav.clipboard = { writeText }
    await shareItinerary('沖繩', '內容')
    expect(writeText).toHaveBeenCalledWith('內容')
    expect(toast).toHaveBeenCalledWith('行程已複製')
  })

  it('stays silent when the user dismisses the share sheet', async () => {
    nav.share = vi.fn(async () => {
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    })
    nav.clipboard = { writeText: vi.fn(async () => {}) }
    await shareItinerary('沖繩', '內容')
    expect(nav.clipboard).toBeDefined()
    expect(toast).not.toHaveBeenCalled()
  })
})
