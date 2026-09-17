import { useState, useEffect, useRef } from 'react'
import { registerToastHost, type ToastAction } from '../lib/toast'

interface Shown {
  message: string
  action?: ToastAction
}

/** An undo has to outlast a glance at the screen; a plain message does not. */
const PLAIN_MS = 3000
const ACTION_MS = 6000

export function Toast() {
  const [shown, setShown] = useState<Shown | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    registerToastHost((message, action) => {
      setShown({ message, action })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setShown(null), action ? ACTION_MS : PLAIN_MS)
    })
    return () => {
      registerToastHost(null)
      clearTimeout(timer.current)
    }
  }, [])

  if (!shown) return null

  const take = () => {
    clearTimeout(timer.current)
    setShown(null)
    shown.action?.onAction()
  }

  return (
    <div
      role="status"
      className="fixed top-3 left-4 right-4 max-w-lg mx-auto z-[60] bg-text-strong text-white text-sm rounded-[10px] px-4 py-2.5 shadow-lg flex items-center gap-3"
    >
      <span className="flex-1 min-w-0">{shown.message}</span>
      {shown.action && (
        <button
          onClick={take}
          className="shrink-0 font-semibold text-white underline underline-offset-2 -my-2 py-2 px-1"
        >
          {shown.action.label}
        </button>
      )}
    </div>
  )
}
