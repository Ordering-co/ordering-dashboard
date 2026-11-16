import { useEffect, useMemo, useRef, useState } from 'react'

import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { fromStaffTab } from './staffKinds'

// redesign BO-B3 (decision 1, auditor #3; analysis.md §2): the glue between the address bar and the staff panel's state.
// The page owns WHICH record is open (the row or the id); this owns where the panel is inside it: `?tab=` and the Custom fields
// dialog (`?tab=metafields`). The address keeps MAIN's parameters (`?id=` and `?tab=`), so no old link needs rewriting: nothing
// is rewritten on load. The other params of the page (`enabled`, `page`, `pageSize`, `q`, `add`) are never touched, except `id`
// and `tab`.

const DEFAULT_SECTION = 'profile'

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

/** What a `?id=&tab=` address says: `{ id, section, customFields }` (an unknown tab is Profile; `metafields` opens Custom fields). */
export const parseStaffQuery = (search) => {
  const params = new URLSearchParams(search || '')
  const { section, customFields } = fromStaffTab(params.get('tab') ?? undefined)
  return { id: positiveInt(params.get('id')), section, customFields }
}

/**
 * The panel's place in the address. Give it the router's `search` (and `locationKey`, so the same address visited again counts);
 * `enabled` is the page's `isUseQuery`: without it the state works but the address is never touched.
 *
 * Returns `section`, `customFieldsOpen`; `setSection(id)` (writes `?tab=`, Profile too, as main does), `setCustomFieldsOpen(open)`
 * (state only); `initialId` (the `?id=` the page was opened with); `request` (`{ key, id }` when the router navigated to a record
 * while the page was open, else null); and the record's moves: `adopt(id)` (that record is the open one, say nothing),
 * `open(id, { section })` (write `?id=`; another record starts at `section` or Profile) and `close()`.
 */
export const useStaffQuery = ({ enabled = true, search = '', locationKey } = {}) => {
  const initial = useMemo(() => parseStaffQuery(search), [])
  const state = useRef({ id: null, section: initial.section, customFieldsOpen: initial.customFields })
  const [shown, setShown] = useState(state.current)
  const [request, setRequest] = useState(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Synchronous (a handler can call two setters in one go) and rendered
  const commit = (changes) => {
    state.current = { ...state.current, ...changes }
    setShown(state.current)
  }

  const api = useMemo(() => ({
    setSection: (section) => {
      commit({ section })
      if (enabledRef.current) addQueryToUrl({ tab: section })
    },
    setCustomFieldsOpen: (open) => commit({ customFieldsOpen: !!open }),
    adopt: (id) => { state.current = { ...state.current, id } },
    open: (id, { section } = {}) => {
      const changed = state.current.id !== id
      if (changed) commit({ id, section: section ?? DEFAULT_SECTION, customFieldsOpen: false })
      else if (section) commit({ section })
      if (!enabledRef.current) return
      if (changed) removeQueryToUrl(['tab'])
      if (section) addQueryToUrl({ tab: section })
      addQueryToUrl({ id })
    },
    close: () => {
      commit({ id: null, section: DEFAULT_SECTION, customFieldsOpen: false })
      if (enabledRef.current) removeQueryToUrl(['id', 'tab'])
    }
  }), [])

  // Afterwards: the router navigated (⌘K) to a record while the page was open. The address it navigated to is the one the router
  // holds, so it is read from `search`; our own `replaceState` writes never reach the router, so they never come back here.
  const visited = useRef({ search, locationKey })
  useEffect(() => {
    if (visited.current.search === search && visited.current.locationKey === locationKey) return
    visited.current = { search, locationKey }
    const parsed = parseStaffQuery(search)
    if (parsed.id == null) return
    state.current = { id: parsed.id, section: parsed.section, customFieldsOpen: parsed.customFields }
    setShown(state.current)
    setRequest({ key: locationKey ?? search, id: parsed.id })
  }, [search, locationKey])

  return {
    section: shown.section,
    customFieldsOpen: shown.customFieldsOpen,
    initialId: initial.id,
    request,
    ...api
  }
}
