import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../../components/Toast'
import { toast } from '../../lib/toast'

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders nothing until a message is pushed', () => {
    render(<Toast />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a pushed message', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    expect(screen.getByRole('status')).toHaveTextContent('儲存失敗')
  })

  it('dismisses itself after 3 seconds', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('runs the action and dismisses when it is taken', () => {
    const onAction = vi.fn()
    render(<Toast />)
    act(() => toast('已刪除「美麗海水族館」', { label: '復原', onAction }))

    act(() => { screen.getByRole('button', { name: '復原' }).click() })

    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('gives a message with an action longer than three seconds to be taken', () => {
    render(<Toast />)
    act(() => toast('已刪除', { label: '復原', onAction: vi.fn() }))

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
