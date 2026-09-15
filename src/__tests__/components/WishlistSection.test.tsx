import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { WishlistSection } from '../../components/WishlistSection'
import type { TripEvent } from '../../types'

const item = (id: string, title: string): TripEvent => ({
  id, type: 'shared', title, time_start: '', time_end: '',
  location: '', notes: '', sort_order: 0,
})

describe('WishlistSection', () => {
  /** The sheet lives on the page now; the section only says what to open. */
  const opened: (TripEvent | null)[] = []
  const onOpen = (event: TripEvent | null) => { opened.push(event) }
  beforeEach(() => { opened.length = 0 })

  it('explains itself when empty and still offers a way in', () => {
    render(<WishlistSection members={[]} events={[]} onOpen={onOpen} />)
    expect(screen.getByText('還沒排進哪一天的地方,先丟這裡。')).toBeInTheDocument()
    expect(screen.getByText('＋ 新增想去的地方')).toBeInTheDocument()
    expect(opened).toEqual([])
  })

  it('lists the collected places with a count', () => {
    render(<WishlistSection members={[]} events={[item('e1', '古宇利島'), item('e2', '瀨長島')]} onOpen={onOpen} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('古宇利島')).toBeInTheDocument()
    expect(screen.getByText('瀨長島')).toBeInTheDocument()
  })

  it('asks for a blank sheet from the add button', () => {
    render(<WishlistSection members={[]} events={[]} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('＋ 新增想去的地方'))
    expect(opened).toEqual([null])
  })

  it('asks for the card it was tapped on, so it can be given a date', () => {
    render(<WishlistSection members={[]} events={[item('e1', '古宇利島')]} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('古宇利島'))
    expect(opened.map((e) => e?.id)).toEqual(['e1'])
  })
})
