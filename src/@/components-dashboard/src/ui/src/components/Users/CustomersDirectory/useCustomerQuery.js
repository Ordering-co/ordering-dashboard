import { useEffect, useMemo, useRef, useState } from 'react'

import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { CUSTOMER_SECTIONS, fromLegacyQuery } from './customerSections'

// redesign UC-B7 (decision 1, auditor #3; analysis.md §8): the glue between the address bar and the customer panel's state.
// The page owns WHICH customer is open (the row or the id); this owns where the panel is inside it: `?section=`, `?wallet=`
// and the Custom fields dialog, and it translates main's links (`?section=user_details&tab=…`, `cash_wallet`, `points_wallet`,
// `metafields`) into the new ones, rewriting the address with `replaceState` (addQueryToUrl / removeQueryToUrl).
// The other params of the page (`enabled`, `page`, `pageSize`, `q`, `add`) are never touched here, except `id`.

const WALLETS = ['cash', 'points']
const DEFAULT_WALLET = 'cash'

const positiveInt = (text) => {
  const value = Number(text)
  return text != null && text !== '' && Number.isInteger(value) && value > 0 ? value : null
}

/**
 * What a `?id=&section=&tab=&wallet=` address says. `query` is the `section`/`wallet` the new address carries (the overview
 * and a wallet outside the Wallet section carry nothing); `legacy` says the address is one of main's (or has a section that
 * does not exist) and is to be rewritten to `query`.
 */
export const parseCustomerQuery = (search) => {
  const params = new URLSearchParams(search || '')
  const rawSection = params.get('section')
  const tab = params.get('tab')
  const mapped = fromLegacyQuery({ section: rawSection ?? undefined, tab: tab ?? undefined })
  const typedWallet = params.get('wallet')
  const wallet = mapped.wallet ?? (mapped.section === 'wallet' && WALLETS.includes(typedWallet) ? typedWallet : null)
  const legacy = tab != null || (rawSection != null && !CUSTOMER_SECTIONS.includes(rawSection))
  const query = {}
  if (mapped.section !== 'overview') query.section = mapped.section
  if (mapped.section === 'wallet' && wallet) query.wallet = wallet
  return { id: positiveInt(params.get('id')), section: mapped.section, wallet, customFields: mapped.customFields, legacy, query }
}

// `section` and `wallet` of the address for a state: the overview has no section, the wallet is only in the Wallet section
const queryOf = ({ section, wallet }) => {
  const set = {}
  const drop = ['tab']
  if (section === 'overview') drop.push('section')
  else set.section = section
  if (section === 'wallet' && wallet) set.wallet = wallet
  else drop.push('wallet')
  return { set, drop }
}

const writeQuery = ({ set, drop }) => {
  removeQueryToUrl(drop)
  if (Object.keys(set).length > 0) addQueryToUrl(set)
}

/**
 * The panel's place in the address. Give it the router's `search` (and `locationKey`, so the same address visited again
 * counts), `enabled` is the page's `isUseQuery`: without it the state works but the address is never touched.
 *
 * Returns `section`, `wallet`, `customFieldsOpen`; `setSection(id)`, `setWallet(wallet)`, `setCustomFieldsOpen(open)`;
 * `initialId` (the `?id=` the page was opened with); `request` (`{ key, id, place, parsed }` when the router navigated to a
 * customer while the page was open, else null: nothing changes until the page takes it); and the customer's moves:
 * `adopt(id)` (that customer is the open one, say nothing), `open(id)` (write `?id=`; another customer starts at the
 * overview), `accept(request)` (the request's customer and place become the open ones; main's link is rewritten),
 * `restore()` (the router moved but the open customer stays: the address goes back to it) and `close()`.
 */
export const useCustomerQuery = ({ enabled = true, search = '', locationKey } = {}) => {
  const initial = useMemo(() => parseCustomerQuery(search), [])
  const state = useRef({
    id: null,
    section: initial.section,
    wallet: initial.wallet ?? DEFAULT_WALLET,
    customFieldsOpen: initial.customFields
  })
  const [shown, setShown] = useState(state.current)
  const [request, setRequest] = useState(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Synchronous (a handler can call two setters in one go: wallet first, then section) and rendered
  const commit = (changes) => {
    state.current = { ...state.current, ...changes }
    setShown(state.current)
  }
  const sync = () => {
    if (enabledRef.current) writeQuery(queryOf(state.current))
  }

  // main's link is rewritten to the new one (`tab` goes, `section` and `wallet` are the new values)
  const rewrite = (parsed) => {
    if (!enabledRef.current || parsed.id == null || !parsed.legacy) return
    writeQuery({ set: parsed.query, drop: ['tab', 'section', 'wallet'].filter(key => !(key in parsed.query)) })
  }

  const api = useMemo(() => ({
    setSection: (section) => {
      commit({ section })
      sync()
    },
    setWallet: (wallet) => {
      commit({ wallet })
      if (state.current.section === 'wallet') sync()
    },
    setCustomFieldsOpen: (open) => commit({ customFieldsOpen: !!open }),
    adopt: (id) => { state.current = { ...state.current, id } },
    open: (id) => {
      const changed = state.current.id !== id
      if (changed) commit({ id, section: 'overview', wallet: DEFAULT_WALLET, customFieldsOpen: false })
      if (!enabledRef.current) return
      if (changed) removeQueryToUrl(['section', 'wallet', 'tab'])
      addQueryToUrl({ id })
    },
    close: () => {
      commit({ id: null, section: 'overview', wallet: DEFAULT_WALLET, customFieldsOpen: false })
      if (enabledRef.current) removeQueryToUrl(['id', 'section', 'wallet', 'tab'])
    },
    // (1): the page takes what the router asked for (no draft in the way, «Discard», or the same customer)
    accept: (taken) => {
      if (!taken) return
      commit({ id: taken.id, ...taken.place })
      rewrite(taken.parsed)
    },
    // (1): «Keep editing» after ⌘K: the open customer stays where it is and the address goes back to it
    restore: () => {
      if (!enabledRef.current || state.current.id == null) return
      addQueryToUrl({ id: state.current.id })
      sync()
    }
  }), [])

  // On load: the address the page was opened with
  useEffect(() => rewrite(initial), [])

  // Afterwards: the router navigated (⌘K) to a customer while the page was open. The address it navigated to is the one the
  // router holds, so it is read from `search`; our own `replaceState` writes never reach the router, so they never come back here.
  // (1): it is only a request. The open customer keeps its section and wallet until the page accepts it: a new wallet
  // remounts the wallet form, and a form that leaves says it is clean, so applying it here lost a draft before the guard ran.
  const visited = useRef({ search, locationKey })
  useEffect(() => {
    if (visited.current.search === search && visited.current.locationKey === locationKey) return
    visited.current = { search, locationKey }
    const parsed = parseCustomerQuery(search)
    if (parsed.id == null) return
    const place = { section: parsed.section, wallet: parsed.wallet ?? DEFAULT_WALLET, customFieldsOpen: parsed.customFields }
    setRequest({ key: locationKey ?? search, id: parsed.id, place, parsed })
  }, [search, locationKey])

  return {
    section: shown.section,
    wallet: shown.wallet,
    customFieldsOpen: shown.customFieldsOpen,
    initialId: initial.id,
    request,
    ...api
  }
}
