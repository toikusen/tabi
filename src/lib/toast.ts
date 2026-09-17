// ponytail: module-level singleton, one Toast host mounted at the app root.
// Swap for a context provider only if a second, independently-scoped host appears.

/** An offer attached to a message — 復原 so far. Taking it dismisses the toast. */
export interface ToastAction {
  label: string
  onAction: () => void
}

type Push = (message: string, action?: ToastAction) => void

let push: Push | null = null

export function registerToastHost(fn: Push | null): void {
  push = fn
}

export function toast(message: string, action?: ToastAction): void {
  push?.(message, action)
}
