import { useEffect, useRef } from 'react'
import { useHistory } from 'react-router-dom'

import { registerRouteLeaveGuard } from '../utils/routeLeaveGuard'

// redesign D-81 (owner, 2026-10-19): one hook for the ways out of a PAGE (not of a panel inside it) that holds unsaved
// work. The page owns a leave-guard host (P/LeaveGuard `useLeaveGuardHost`) and passes its `requestLeave`; this hook sends to it
// every way out the host cannot see by itself:
//   - a route change to ANOTHER pathname (sidebar links, links, the browser's back and forward): `history.block` of react-router v5.
//     A change of the same pathname (the query string, the hash: `?section=`, `?tab=`) goes through without asking.
//   - ⌘K and Mia (`useDashboardNavigation`), through `registerRouteLeaveGuard`.
//   - closing or reloading the tab: `beforeunload` (the browser's own prompt; it cannot be worded).
// All three exist only while `active` (there is unsaved work): a clean page is never held.
//
// `history.block` runs inside the router's own transition. A blocked one returns `false`, the address and the page stay as they were,
// and the host asks «Keep editing · Save · Discard». When the host lets go (`proceed`: Discard, or Save that worked) the blocked
// navigation is repeated, once, with the block lifted. A Save that fails never calls `proceed`: the user stays.
//
// redesign bugs E: a page and a piece inside it may both hold unsaved work (the store editor and the menu's Custom
// fields, the stores list and its Importers panel). history v4 keeps ONE prompt (`history.block` replaces the previous one, and the
// one that goes clean sets it to none), so every guard of a history shares one block and one ⌘K/Mia guard: they ask the active
// guards from the last that became active (the piece on top) to the first (the page behind), as P/LeaveGuard's nested guards do,
// and the navigation goes once, when the last one lets go. One that keeps the user ends it.
//
//   useRouteLeaveGuard({ active, requestLeave })
//     active        boolean  there is unsaved work
//     requestLeave  (proceed: () => void, onCancel?: () => void) => any   the host's, from `useLeaveGuardHost()`

// One record per history: the entries the user has visited (to repeat a back/forward by its distance), the active guards and the
// one block they share. It lives while a page using the hook is mounted, active or not.
const records = new WeakMap()

const recordOf = (history) => {
  let record = records.get(history)
  if (!record) {
    record = { users: 0, guards: [], stack: { keys: [history.location?.key], index: 0 }, bypass: false, unlisten: null, unblock: null, unpalette: null }
    records.set(history, record)
  }
  return record
}

const retain = (history) => {
  const record = recordOf(history)
  record.users += 1
  if (!record.unlisten) {
    record.unlisten = history.listen((location, action) => {
      const entries = record.stack
      if (action === 'PUSH') {
        entries.keys = [...entries.keys.slice(0, entries.index + 1), location.key]
        entries.index = entries.keys.length - 1
      } else if (action === 'REPLACE') {
        entries.keys[entries.index] = location.key
      } else {
        const at = entries.keys.indexOf(location.key)
        if (at >= 0) entries.index = at
      }
      // a repeated back/forward is async: the block is lifted until the router has finished it
      if (action === 'POP') record.bypass = false
    })
  }
  return () => {
    record.users -= 1
    if (record.users > 0) return
    record.unlisten?.()
    record.unblock?.()
    record.unblock = null
    record.unpalette?.()
    record.unpalette = null
    record.guards = []
    records.delete(history)
  }
}

// the navigation the user agreed to goes through the block
const bypassing = (record, go) => {
  record.bypass = true
  try {
    go()
  } finally {
    record.bypass = false
  }
}

// Asks the active guards, the last that became active first; `done` runs once every one has let go.
const askInTurn = (record, done) => {
  const chain = [...record.guards].reverse()
  const step = (index) => (index < chain.length ? chain[index].current(() => step(index + 1)) : done())
  step(0)
}

const promptOf = (history, record) => (location, action) => {
  if (record.bypass) return undefined
  // the same page (query string, hash): nothing to protect
  if (location.pathname === history.location.pathname) return undefined
  const entries = record.stack
  const at = action === 'POP' ? entries.keys.indexOf(location.key) : -1
  const delta = at >= 0 ? at - entries.index : -1
  let sync = true
  let wentAtOnce = false
  askInTurn(record, () => {
    // every guard had nothing dirty after all: this very transition goes on
    if (sync) {
      wentAtOnce = true
      return
    }
    if (action === 'POP') {
      record.bypass = true
      history.go(delta || -1)
      return
    }
    bypassing(record, () => (action === 'REPLACE' ? history.replace(location) : history.push(location)))
  })
  sync = false
  return wentAtOnce ? undefined : false
}

// → unregister. The block and the ⌘K/Mia guard exist while at least one guard is active. What ⌘K and Mia do next is a push the user
// agreed to, so the block lets it through.
const addGuard = (history, askRef) => {
  const record = recordOf(history)
  record.guards = [...record.guards, askRef]
  if (!record.unblock) record.unblock = history.block(promptOf(history, record))
  if (!record.unpalette) record.unpalette = registerRouteLeaveGuard(proceed => askInTurn(record, () => bypassing(record, proceed)))
  return () => {
    record.guards = record.guards.filter(guard => guard !== askRef)
    if (record.guards.length > 0) return
    record.unblock?.()
    record.unblock = null
    record.unpalette?.()
    record.unpalette = null
  }
}

/**
 * @param {object} options
 * @param {boolean} options.active whether there is unsaved work to protect
 * @param {(proceed: () => void, onCancel?: () => void) => any} options.requestLeave the host's `requestLeave`
 */
export const useRouteLeaveGuard = ({ active, requestLeave }) => {
  const history = useHistory()
  // read at interception time, so the subscriptions need no re-registering when the host re-renders
  const askRef = useRef(requestLeave)
  askRef.current = requestLeave

  // It follows the history even while the page is clean (declared first: it is there before a guard is added).
  useEffect(() => retain(history), [history])

  // a route change to another pathname, ⌘K and Mia: keeping the user leaves everything where it was
  useEffect(() => (active ? addGuard(history, askRef) : undefined), [active, history])

  useEffect(() => {
    if (!active) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
}
