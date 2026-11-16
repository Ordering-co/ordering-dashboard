import { useCallback, useRef } from 'react'

// redesign my-products R1-02: a save disables the control that started it (a Save button while it saves and after,
// with nothing left to save; a field that saves by itself while its request runs), so the browser drops the focus on <body>.
// `remember()` notes where the focus is when the save starts; `restore(fallback, { preferFallback })` runs when it ends: if the
// focus was lost, it goes back to that control when it can take it again, or else to `fallback` (the line that says how the save
// went, which then needs `tabIndex={-1}`). With `preferFallback` (a failed save) it goes to `fallback` first, so the message is
// read. Focus that moved somewhere else on purpose meanwhile is left alone. <body> is never «the control» (a click that does not
// focus its button, as in Safari, starts from <body>).

const RETRIES = 3
const RETRY_MS = 50

const lost = () => {
  const active = typeof document === 'undefined' ? null : document.activeElement
  return !active || active === document.body
}

const isControl = (node) => Boolean(node && node !== document.body && node.isConnected)

const canTakeFocus = (node) => isControl(node) && !node.disabled && node.getAttribute?.('aria-disabled') !== 'true'

const resolve = (fallback) => {
  const target = typeof fallback === 'function' ? fallback() : fallback?.current ?? fallback
  return target && target.isConnected ? target : null
}

export const useKeepFocus = () => {
  const startedFrom = useRef(null)

  const remember = useCallback(() => {
    startedFrom.current = typeof document === 'undefined' ? null : document.activeElement
  }, [])

  const restore = useCallback((fallback, { preferFallback = false } = {}) => {
    const from = startedFrom.current
    startedFrom.current = null
    const attempt = (left) => {
      if (!lost()) return
      const target = resolve(fallback)
      if (preferFallback && target) {
        target.focus()
        return
      }
      if (canTakeFocus(from)) {
        from.focus()
        return
      }
      // the control may still be disabled until React commits the end of the save: wait for it a little, unless there is a
      // fallback to take the focus now
      if (isControl(from) && !target && left > 0) {
        setTimeout(() => attempt(left - 1), RETRY_MS)
        return
      }
      if (target) target.focus()
    }
    setTimeout(() => attempt(RETRIES), 0)
  }, [])

  return { remember, restore }
}
