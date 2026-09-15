import { describe, expect, it } from 'vitest'
import { eventCategory } from '../../lib/category'

describe('eventCategory', () => {
  it('matches the five categories from real itinerary titles', () => {
    expect(eventCategory('一蘭拉麵 本店')).toBe('food')
    expect(eventCategory('Hyatt Naha 入住')).toBe('lodging')
    expect(eventCategory('那霸空港 → 國際通')).toBe('transport')
    expect(eventCategory('美麗海水族館')).toBe('sight')
    expect(eventCategory('唐吉訶德 掃貨')).toBe('shopping')
  })

  it('falls back to the neutral pin instead of guessing', () => {
    expect(eventCategory('跟阿凱碰面')).toBe('pin')
    expect(eventCategory('')).toBe('pin')
  })

  it('reads a bare flight or train code as transport', () => {
    expect(eventCategory('BR116 桃園 → 那霸')).toBe('transport')
    expect(eventCategory('JR500 新大阪 → 博多')).toBe('transport')
  })

  it('does not mistake a booking code for a flight', () => {
    expect(eventCategory('訂房代號 X7K92')).toBe('pin')
  })

  it('does not read "dinner" as an inn', () => {
    expect(eventCategory('dinner at Zauo')).toBe('food')
  })

  it('prefers the checked-in stop when a title mentions both', () => {
    expect(eventCategory('飯店早餐')).toBe('lodging')
  })
})
