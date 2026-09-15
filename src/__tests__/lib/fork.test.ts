// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { groupEmails, groupFor, groupLabel } from '../../lib/fork'
import type { ForkItem, TripEvent } from '../../types'

const members = [
  { email: 'ted@test.com', display_name: 'Ted Hsu', avatar_url: '' },
  { email: 'sei@test.com', display_name: '成', avatar_url: '' },
  { email: 'ann@test.com', display_name: '', avatar_url: '' },
]
const group = (emails: string[], others = false, title = ''): ForkItem => ({ emails, others, title, location: '', notes: '' })
/** A group written before groups had emails: one free-text name */
const legacy = (person: string, title = ''): ForkItem => ({ person, title, location: '', notes: '' }) as unknown as ForkItem

describe('groupEmails', () => {
  it('reads a group\'s emails as saved', () => {
    expect(groupEmails(group(['sei@test.com']), members)).toEqual(['sei@test.com'])
  })

  it('matches an old free-text name to the member going by it, and nobody otherwise', () => {
    expect(groupEmails(legacy('成'), members)).toEqual(['sei@test.com'])
    expect(groupEmails(legacy('同事'), members)).toEqual([])
  })
})

describe('groupLabel', () => {
  it('names a group by its members\' current names, in trip order', () => {
    expect(groupLabel(group(['sei@test.com', 'ted@test.com']), members)).toBe('Ted Hsu、成')
  })

  it('falls back to the email for a member with no display name', () => {
    expect(groupLabel(group(['ann@test.com']), members)).toBe('ann@test.com')
  })

  it('reads 其他人 for everyone not named elsewhere, after anyone named alongside them', () => {
    expect(groupLabel(group([], true), members)).toBe('其他人')
    expect(groupLabel(group(['ted@test.com'], true), members)).toBe('Ted Hsu、其他人')
  })

  it('leaves out someone who has left the trip', () => {
    expect(groupLabel(group(['gone@test.com', 'ted@test.com']), members)).toBe('Ted Hsu')
  })

  it('reads 未指定 for a group a removal or a bind left with nobody', () => {
    expect(groupLabel(group(['gone@test.com']), members)).toBe('未指定')
    expect(groupLabel(group([]), members)).toBe('未指定')
  })

  it('keeps an old group\'s name, current when it matches a member', () => {
    expect(groupLabel(legacy('同事'), members)).toBe('同事')
    expect(groupLabel(legacy('成'), members)).toBe('成')
  })
})

describe('groupFor', () => {
  const event: TripEvent = {
    id: 'f', type: 'fork', title: '', time_start: '13:30', time_end: '', location: '', notes: '', sort_order: 0,
    fork_items: [group(['sei@test.com'], false, '跑場'), group([], true, '首里城')],
  }

  it('finds the group a member is named in', () => {
    expect(groupFor(event, 'sei@test.com', members)?.title).toBe('跑場')
  })

  it('puts anyone not named with 其他人', () => {
    expect(groupFor(event, 'ted@test.com', members)?.title).toBe('首里城')
  })

  it('finds nothing when there is no 其他人 group to fall into', () => {
    expect(groupFor({ ...event, fork_items: [group(['sei@test.com'], false, '跑場')] }, 'ted@test.com', members)).toBeUndefined()
  })

  it('finds a member in an old group by their name', () => {
    expect(groupFor({ ...event, fork_items: [legacy('同事', '首里城'), legacy('成', '跑場')] }, 'sei@test.com', members)?.title).toBe('跑場')
  })
})
