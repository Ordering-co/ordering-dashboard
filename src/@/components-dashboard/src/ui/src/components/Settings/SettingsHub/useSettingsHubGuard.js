import { useCallback, useEffect, useRef, useState } from 'react'

// redesign settings A (owner decision 17): the discard guard of the Settings hub.
//
// The forms inside a section tell the hub their state with `report(sectionKey, { dirty, saving })` (or `null` when they
// unmount). While any of them is dirty or saving, the guard blocks in the router every navigation that leaves the section on
// screen (another category or group, the landing, another route, ⌘K, links, the sidebar, the browser's back button) and asks
// first. What stays in the same section (typing in the search, `focus`, `q`, the editor params) goes through.
//
// `history.block` runs inside the router's own transition, so one place covers every way out. A blocked transition returns
// `false` (no browser prompt): the hub shows a P/ConfirmDialog with `pending`, and answers with `keepEditing` or `discard`.
// `discard` unblocks and repeats the navigation that was intercepted. `beforeunload` covers reload and closing the tab.

const summarize = (reports) => {
  let dirty = false
  let saving = false
  reports.forEach((state) => {
    if (state.dirty) dirty = true
    if (state.saving) saving = true
  })
  return { active: dirty || saving, dirty, saving }
}

/**
 * @param {object}   options
 * @param {object}   options.history                 the router's history (react-router v5, `history` v4)
 * @param {Function} options.getCurrentSectionKey    () => key of the section on screen, or null
 * @param {Function} options.getCurrentSectionLabel  () => its translated label (for the dialog)
 * @param {Function} options.getLocationSectionKey   (location) => key of the section that location opens, or null when it
 *                                                    opens none (landing, phone navigation, another route)
 * @returns {{ report: Function, pending: ?object, dirty: boolean, saving: boolean, keepEditing: Function, discard: Function }}
 */
export const useSettingsHubGuard = ({
  history,
  getCurrentSectionKey,
  getCurrentSectionLabel,
  getLocationSectionKey
}) => {
  const reportsRef = useRef(new Map())
  const unblockRef = useRef(null)
  const pendingRef = useRef(null)
  // The callbacks are read at interception time, so the blocker needs no re-subscribing when they change.
  const getters = useRef({})
  getters.current = { getCurrentSectionKey, getCurrentSectionLabel, getLocationSectionKey }

  const [status, setStatus] = useState({ active: false, dirty: false, saving: false })
  const [pending, setPendingState] = useState(null)

  const setPending = useCallback((next) => {
    pendingRef.current = next
    setPendingState(next)
  }, [])

  const report = useCallback((sectionKey, state) => {
    if (state && (state.dirty || state.saving)) {
      reportsRef.current.set(sectionKey, { dirty: !!state.dirty, saving: !!state.saving })
    } else {
      reportsRef.current.delete(sectionKey)
    }
    const next = summarize(reportsRef.current)
    setStatus(prev => (
      prev.active === next.active && prev.dirty === next.dirty && prev.saving === next.saving ? prev : next
    ))
  }, [])

  // Where each visited entry sits in the stack, so a blocked back/forward can be repeated by its distance.
  const stackRef = useRef({ keys: [history.location?.key], index: 0 })
  useEffect(() => history.listen((location, action) => {
    const stack = stackRef.current
    if (action === 'PUSH') {
      // after undoing a blocked Back, history v4 repeats the last notification; a push of the entry the stack
      // already stands on is that repeat, not a new step (the phone section is a push since )
      if (location.key === stack.keys[stack.index]) return
      stack.keys = [...stack.keys.slice(0, stack.index + 1), location.key]
      stack.index = stack.keys.length - 1
    } else if (action === 'REPLACE') {
      stack.keys[stack.index] = location.key
    } else {
      const at = stack.keys.indexOf(location.key)
      if (at >= 0) stack.index = at
    }
  }), [history])

  useEffect(() => {
    if (!status.active) return undefined
    const unblock = history.block((location, action) => {
      const { getCurrentSectionKey: current, getCurrentSectionLabel: label, getLocationSectionKey: target } = getters.current
      const currentKey = current()
      // Nothing on screen to protect, or the same section stays open: let it through.
      if (!currentKey || target(location) === currentKey) return undefined
      const stack = stackRef.current
      const at = action === 'POP' ? stack.keys.indexOf(location.key) : -1
      setPending({
        location,
        action,
        delta: at >= 0 ? at - stack.index : -1,
        sectionLabel: label()
      })
      return false
    })
    unblockRef.current = unblock
    return () => {
      unblock()
      if (unblockRef.current === unblock) unblockRef.current = null
    }
  }, [history, status.active, setPending])

  useEffect(() => {
    if (!status.dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [status.dirty])

  const keepEditing = useCallback(() => setPending(null), [setPending])

  const discard = useCallback(() => {
    const intercepted = pendingRef.current
    setPending(null)
    unblockRef.current?.()
    unblockRef.current = null
    reportsRef.current.clear()
    setStatus({ active: false, dirty: false, saving: false })
    if (!intercepted) return
    if (intercepted.action === 'POP') history.go(intercepted.delta)
    else if (intercepted.action === 'REPLACE') history.replace(intercepted.location)
    else history.push(intercepted.location)
  }, [history, setPending])

  return { report, pending, dirty: status.dirty, saving: status.saving, keepEditing, discard }
}
