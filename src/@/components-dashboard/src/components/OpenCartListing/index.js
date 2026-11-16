import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { fetchAllPages } from '../../utils/fetchAllPages'
import {
  CART_VIEWS,
  DAY_FIGURES_CAP,
  DETAIL_CONCURRENCY,
  FOLLOW_UP_CAP,
  LIVE_CAP,
  API_PAGE_MAX,
  LIVE_POLL_MS,
  buildCartsPath,
  buildCartsWhere,
  cartTotal,
  contactOf,
  rankFollowUp,
  searchDigits,
  startOfLocalDay,
  viewsOfCart
} from '../../utils/openCarts'

// redesign OC-A (data contract): the controller of the open carts queue. It renders no markup:
// it hands `UIComponent` the view, search, filters, list, counts, details, rules, figures and
// live state described in redesign/pages/open-carts/plan.md ("Contrato de datos").

const PAGE_SIZES = [10, 25, 50]
const EMPTY_FILTERS = { businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: null } }
const NO_COUNTS = { followUp: null, paymentFailed: null, live: null, all: null }
const ZERO_COUNTS = { followUp: 0, paymentFailed: 0, live: 0, all: 0 }
// redesign a count is a number (known), null (on its way) or COUNT_UNAVAILABLE (asked for and it could not be read), so a
// failed count is never drawn as a skeleton that waits for ever. The header reads the same word.
export const COUNT_UNAVAILABLE = 'unavailable'
const UNAVAILABLE_COUNTS = { followUp: COUNT_UNAVAILABLE, paymentFailed: COUNT_UNAVAILABLE, live: COUNT_UNAVAILABLE, all: COUNT_UNAVAILABLE }
// redesign OC-F3 (OC-Q1-09): a failed detail is asked for again by itself once it is this old, at most DETAIL_ATTEMPTS times per cart + updated_at
const DETAIL_RETRY_MS = 10000
const DETAIL_ATTEMPTS = 3

class ApiError extends Error {
  constructor (result) {
    super(Array.isArray(result) ? result.join(', ') : String(result))
    this.result = result
  }
}

// What the UI shows for a failure: the API's own messages, or the network error's text
const errorsOf = (error) => (error instanceof ApiError ? error.result : [error?.message || String(error)])

const jsonOptions = (token, method = 'GET', body) => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  ...(body !== undefined && { body: JSON.stringify(body) })
})

const request = async (url, options) => {
  const response = await fetch(url, options)
  return response.json()
}

const toList = (value) => (Array.isArray(value) ? value : [])
const toDate = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value : null)

// redesign OC-A (M-2): every change of a filter goes through here so equal filters are equal
const normalizeFilters = (previous, partial = {}) => {
  const activity = partial.lastActivity ? { ...previous.lastActivity, ...partial.lastActivity } : previous.lastActivity
  return {
    businessIds: toList(partial.businessIds ?? previous.businessIds),
    customerIds: toList(partial.customerIds ?? previous.customerIds),
    cityIds: toList(partial.cityIds ?? previous.cityIds),
    lastActivity: { from: toDate(activity?.from), to: toDate(activity?.to) }
  }
}

const filtersKey = (filters) => JSON.stringify([
  filters.businessIds,
  filters.customerIds,
  filters.cityIds,
  filters.lastActivity.from?.getTime() ?? null,
  filters.lastActivity.to?.getTime() ?? null
])

// '' no search, 'nodigits' a search with no digit (nothing to ask), else the digits
const searchKeyOf = (search) => {
  if (!String(search ?? '').trim()) return ''
  return searchDigits(search) || 'nodigits'
}

const emptySource = (view, pageSize, extra = {}) => ({
  view,
  loading: false,
  error: null,
  carts: [],
  total: 0,
  totalPages: 1,
  page: 1,
  pageSize,
  capped: false,
  searchWithoutDigits: false,
  loadedAt: Date.now(),
  ...extra
})

// The detail comes without the user and with the business thinner than the list's: the list's
// data is merged in, as the panel always got it (main's `components/OpenCartsDetail`, since removed)
const mergeDetail = (cart, result) => ({
  ...result,
  id: cart.id,
  uuid: cart.uuid,
  user_id: cart.user_id,
  status: cart.status ?? result?.status,
  business: { ...result?.business, ...cart.business },
  user: { ...cart.user, ...(cart.address?.address && { address: cart.address.address }) },
  updated_at: cart.updated_at
})

export const OpenCartListing = (props) => {
  props = { ...defaultProps, ...props }
  const { UIComponent, paginationSettings, initialView, initialWithContactOnly } = props
  // the list brings each cart's total (`params=totals`, computed without writing) and no row asks for its detail:
  // GET /carts/{uuid} writes (offer_id, updated_at, cart_offers, payments, wallets). An API without totals leaves the rows
  // unseeded, so they read their detail as before.
  const totalsParam = 'totals'

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, toastActions] = useToast()
  const [{ token, loading: sessionLoading }] = useSession()
  const ready = !sessionLoading && Boolean(token)

  // The latest session and API root for functions that must keep their identity
  const context = useRef({})
  context.current = { root: ordering?.root, token }
  // redesign OC-F2 (OC-Q1-04): the toast of a delete is said by the function that outlives the render it came from
  const notify = useRef(() => {})
  notify.current = (type, text) => toastActions?.showToast?.(type, text)
  const cartDeletedText = t('CART_DELETED', 'Cart deleted')
  const cartDeleted = useRef(cartDeletedText)
  cartDeleted.current = cartDeletedText

  const [view, setView] = useState(CART_VIEWS.includes(initialView) ? initialView : 'followUp')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [withContactOnly, setWithContactOnly] = useState(initialWithContactOnly !== false) // redesign OC-F3 (OC-Q1-08): the page keeps it in the URL
  const [page, setPage] = useState(
    (paginationSettings.controlType === 'pages' && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1
  )
  const [pageSize, setPageSize] = useState(paginationSettings.pageSize ?? 10)

  const [source, setSource] = useState(() => ({ ...emptySource(CART_VIEWS.includes(initialView) ? initialView : 'followUp', paginationSettings.pageSize ?? 10), loading: true, loadedAt: null }))
  const [counts, setCounts] = useState(NO_COUNTS)
  const [controls, setControls] = useState({ businesses: [], cities: [] })
  const [rules, setRules] = useState({ loading: true, total: null, enabled: null })
  const [dayFigures, setDayFigures] = useState({ loading: true, activeToday: null, atStakeToday: null, capped: false })
  const [live, setLive] = useState({ lastUpdatedAt: null, refreshing: false, newIds: [] })
  const [details, setDetails] = useState({})

  // ---- refs: values the asynchronous work reads at the moment it needs them ----
  const mounted = useRef(false)
  const detailsRef = useRef({})
  const inflight = useRef({})
  const queue = useRef([])
  const active = useRef(0)
  const listRequest = useRef(0)
  const countsRequest = useRef(0)
  const dayRequest = useRef(0)
  const cityCache = useRef({})
  const sourceRef = useRef(source)
  const dayFiguresRef = useRef(null)
  const refreshing = useRef(false)
  const dayCarts = useRef({})
  const searchRef = useRef(search)
  const filtersRef = useRef(filters)

  sourceRef.current = source
  dayFiguresRef.current = dayFigures
  searchRef.current = search
  filtersRef.current = filters
  const queryRef = useRef({})
  queryRef.current = { view, search, filters, page, pageSize }

  // ---- details: max DETAIL_CONCURRENCY at a time, stored by id + updated_at ----

  const commitDetails = (update) => {
    detailsRef.current = update(detailsRef.current)
    if (mounted.current) setDetails(detailsRef.current)
  }

  const pump = () => {
    while (active.current < DETAIL_CONCURRENCY && queue.current.length) {
      const job = queue.current.shift()
      active.current++
      job().finally(() => {
        active.current--
        pump()
      })
    }
  }

  const limited = (task) => new Promise((resolve) => {
    queue.current.push(() => task().then(resolve))
    pump()
  })

  const loadDetail = (cart) => {
    const stamp = cart.updated_at ?? null
    const promise = limited(async () => {
      let entry
      const previous = detailsRef.current[cart.id]?.cart ?? null
      const previousFull = detailsRef.current[cart.id]?.full && { full: true }
      const attempts = detailsRef.current[cart.id]?.attempts ?? 1
      try {
        const { root, token: accessToken } = context.current
        const content = await request(`${root}/carts/${cart.uuid}?user_id=${cart.user_id}`, jsonOptions(accessToken))
        entry = content.error
          ? { loading: false, error: content.result, cart: previous, updatedAt: stamp, attempts, failedAt: Date.now(), ...previousFull }
          : { loading: false, error: null, cart: mergeDetail(cart, content.result), updatedAt: stamp, attempts, full: true }
      } catch (error) {
        entry = { loading: false, error: errorsOf(error), cart: previous, updatedAt: stamp, attempts, failedAt: Date.now(), ...previousFull }
      }
      // a newer version of the cart may have been asked for meanwhile: that one wins
      if (detailsRef.current[cart.id]?.updatedAt === stamp) {
        commitDetails(all => ({ ...all, [cart.id]: entry }))
      }
    })
    inflight.current[cart.id] = { stamp, promise }
    promise.then(() => {
      if (inflight.current[cart.id]?.promise === promise) delete inflight.current[cart.id]
    })
    return promise
  }

  /**
   * stores, as a `partial` detail, what the list brought with `params=totals` (its total and its products' names), so
   * the rows need no GET /carts/{uuid}. A total the API could not compute (null) is a failed entry that is not retried by itself.
   * It never replaces a full detail of the same `updated_at`. Answers the carts without the totals (an API without them).
   */
  const seedDetails = (carts) => {
    const without = []
    const seeds = {}
    toList(carts).forEach(cart => {
      if (!cart || cart.id == null) return
      if (!('total' in cart)) {
        without.push(cart)
        return
      }
      const stamp = cart.updated_at ?? null
      const entry = detailsRef.current[cart.id]
      if (entry && entry.updatedAt === stamp && (!entry.partial || entry.loading)) return
      seeds[cart.id] = cart.total == null
        ? { loading: false, error: [t('OPEN_CARTS_DETAIL_UNAVAILABLE', "Couldn't load the details of this cart")], cart: entry?.cart ?? null, updatedAt: stamp, attempts: DETAIL_ATTEMPTS, failedAt: Date.now(), partial: true }
        : { loading: false, error: null, cart: mergeDetail(cart, cart), updatedAt: stamp, attempts: 1, partial: true }
    })
    if (Object.keys(seeds).length) commitDetails(all => ({ ...all, ...seeds }))
    return without
  }

  /**
   * Reads the detail of these carts (`GET /carts/{uuid}?user_id=`), the ones not stored yet or
   * stored for another `updated_at`. redesign OC-F3 (OC-Q1-09): a failed one is asked for again by itself when this is called again
   * and its failure is older than DETAIL_RETRY_MS, at most DETAIL_ATTEMPTS times for the same `updated_at`; `{ retry: true }` does
   * not wait and ignores the cap (it counts as one more attempt). `{ full: true }` (the open panel) also reads a `partial` one.
   * Answers when all of them have settled. The details are never dropped.
   */
  const ensureDetails = useCallback((carts, { retry = false, full = false } = {}) => {
    const wanted = []
    const seen = new Set()
    ;(Array.isArray(carts) ? carts : [carts]).forEach(cart => {
      if (cart && cart.id != null && cart.uuid && !seen.has(cart.id)) {
        seen.add(cart.id)
        wanted.push(cart)
      }
    })
    const toLoad = []
    const running = []
    wanted.forEach(cart => {
      const entry = detailsRef.current[cart.id]
      if (entry && entry.updatedAt === (cart.updated_at ?? null)) {
        if (entry.loading) {
          const current = inflight.current[cart.id]
          if (current) running.push(current.promise)
          return
        }
        if (!entry.error && !(full && entry.partial)) return
        const due = Date.now() - (entry.failedAt ?? 0) >= DETAIL_RETRY_MS && (entry.attempts ?? 1) < DETAIL_ATTEMPTS
        if (!retry && !due && !(full && entry.partial)) return
      }
      toLoad.push(cart)
    })
    if (toLoad.length) {
      commitDetails(all => {
        const next = { ...all }
        toLoad.forEach(cart => {
          const stamp = cart.updated_at ?? null
          const attempts = all[cart.id]?.updatedAt === stamp ? (all[cart.id].attempts ?? 0) + 1 : 1
          next[cart.id] = { loading: true, error: null, cart: all[cart.id]?.cart ?? null, updatedAt: stamp, attempts, ...(all[cart.id]?.full && { full: true }) }
        })
        return next
      })
    }
    return Promise.all([...running, ...toLoad.map(loadDetail)]).then(() => undefined)
  }, [])

  // ---- filters: the city becomes the businesses of that city (M-3) ----

  const lookupCityBusinesses = async (cityIds) => {
    const { root, token: accessToken } = context.current
    const where = [{ attribute: 'city_id', value: cityIds }]
    const url = `${root}/business?mode=dashboard&params=id,city_id&where=${encodeURIComponent(JSON.stringify(where))}`
    const content = await fetchAllPages(url, jsonOptions(accessToken))
    if (content.error) throw new ApiError(content.result)
    const wanted = cityIds.map(String)
    return toList(content.result)
      // the API ignores what it does not know: do not trust a business that says it is elsewhere
      .filter(business => business && business.id != null && (business.city_id == null || wanted.includes(String(business.city_id))))
      .map(business => business.id)
  }

  // { ids, empty }: `ids` go to `business_id`; `empty` means nothing can match (no request needed)
  const resolveBusinessIds = async (current) => {
    const chosen = current.businessIds
    if (!current.cityIds.length) return { ids: chosen, empty: false }
    const key = [...current.cityIds].sort((a, b) => a - b).join(',')
    let lookup = cityCache.current[key]
    if (!lookup) {
      lookup = lookupCityBusinesses(current.cityIds)
      cityCache.current[key] = lookup
      lookup.catch(() => { if (cityCache.current[key] === lookup) delete cityCache.current[key] })
    }
    const inCity = await lookup
    const ids = chosen.length ? chosen.filter(id => inCity.some(other => String(other) === String(id))) : inCity
    return { ids, empty: ids.length === 0 }
  }

  // ---- the list of the current view ----

  /**
   * One request per change. Follow up reads up to FOLLOW_UP_CAP carts of the week in one request
   * and all their details, and the client ranks and pages them; the other views page on the
   * server by last activity and read the details of the visible rows. `silent` reloads in place.
   */
  const loadList = async (query, { silent = false } = {}) => {
    const id = ++listRequest.current
    const stale = () => id !== listRequest.current || !mounted.current
    const digits = searchDigits(query.search)
    const isFollowUp = query.view === 'followUp'
    const isLive = query.view === 'live'

    // the rows of another view are not kept while this one loads
    if (!silent) {
      setSource(previous => ({
        ...previous,
        view: query.view,
        loading: true,
        error: null,
        searchWithoutDigits: false,
        ...(previous.view === query.view ? {} : { carts: [], total: 0, capped: false })
      }))
    }

    // redesign OC-A (M-1): a search with no digits has nothing to search by
    if (searchKeyOf(query.search) === 'nodigits') {
      setSource(emptySource(query.view, query.pageSize, { searchWithoutDigits: true }))
      return
    }

    try {
      const resolved = await resolveBusinessIds(query.filters)
      if (stale()) return
      if (resolved.empty) {
        setSource(emptySource(query.view, query.pageSize))
        return
      }

      const now = new Date()
      const where = buildCartsWhere({
        view: query.view,
        search: digits,
        businessIds: resolved.ids,
        customerIds: query.filters.customerIds,
        lastActivity: query.filters.lastActivity,
        now
      })
      const { root, token: accessToken } = context.current
      const fetchPage = (page, pageSize) => request(`${root}${buildCartsPath({ page, pageSize, orderBy: '-updated_at', params: totalsParam, where })}`, jsonOptions(accessToken))
      let content
      if (isFollowUp) {
        // redesign OC-integration: the API caps page_size at 50 (above it answers 10): Follow up reads the week in pages of 50, up to FOLLOW_UP_CAP
        content = await fetchPage(1, API_PAGE_MAX)
        let page = 1
        while (!content.error && Array.isArray(content.result) && content.result.length < FOLLOW_UP_CAP && Number(content.pagination?.total_pages) > page) {
          page++
          const next = await fetchPage(page, API_PAGE_MAX)
          if (stale()) return
          if (next.error) { content = next; break }
          content = { ...content, result: [...content.result, ...(next.result || [])].slice(0, FOLLOW_UP_CAP) }
        }
      } else {
        content = await fetchPage(isLive ? 1 : query.page, isLive ? LIVE_CAP : query.pageSize)
      }
      if (stale()) return

      // redesign OC-A (M-8): a failure is shown, not an empty table
      if (content.error) {
        setSource(previous => ({ ...previous, loading: false, error: content.result, ...(silent ? {} : { carts: [], total: 0 }) }))
        return
      }

      const carts = Array.isArray(content.result) ? content.result : []
      const pagination = content.pagination || {}
      const total = Number(pagination.total ?? carts.length)

      // the ranking needs every value: Follow up waits for the details, the other views do not
      const unseeded = seedDetails(carts)
      if (isFollowUp) {
        await ensureDetails(unseeded)
        if (stale()) return
      } else {
        ensureDetails(unseeded)
      }

      const known = new Set(sourceRef.current.carts.map(cart => cart.id))
      const newIds = silent && sourceRef.current.view === query.view ? carts.filter(cart => !known.has(cart.id)).map(cart => cart.id) : []

      setSource({
        view: query.view,
        loading: false,
        error: null,
        carts,
        total,
        totalPages: isFollowUp || isLive ? 1 : Number(pagination.total_pages) || 1,
        page: isFollowUp || isLive ? 1 : Number(pagination.current_page) || query.page,
        pageSize: isFollowUp || isLive ? query.pageSize : (Number(pagination.page_size) || query.pageSize),
        capped: (isFollowUp || isLive) && total > carts.length,
        searchWithoutDigits: false,
        loadedAt: now.getTime()
      })
      setCounts(previous => (previous[query.view] === total ? previous : { ...previous, [query.view]: total }))
      setLive(previous => ({ ...previous, lastUpdatedAt: Date.now(), newIds }))
    } catch (error) {
      if (stale()) return
      setSource(previous => ({ ...previous, loading: false, error: errorsOf(error), ...(silent ? {} : { carts: [], total: 0 }) }))
    }
  }

  // redesign OC-A (live): reloads the list in place; the rows and the open panel stay
  const refresh = useCallback(() => {
    if (sourceRef.current.loading || refreshing.current) return Promise.resolve()
    refreshing.current = true
    setLive(previous => ({ ...previous, refreshing: true }))
    // redesign OC-F2 (OC-Q1-10): the counts and the figures of today move with the list, in silence
    return Promise.all([
      loadList(queryRef.current, { silent: true }),
      loadCounts(queryRef.current, { silent: true }),
      loadDayFigures({ silent: true })
    ]).finally(() => {
      refreshing.current = false
      if (mounted.current) setLive(previous => (previous.refreshing ? { ...previous, refreshing: false } : previous))
    })
  }, [])

  // Full reload of the current view (the "Retry" of a failed list). redesign it asks again for everything that can have failed
  // with the list: the counts of the four views and the figures of today. What is on screen stays until the new answer comes; what had
  // failed goes back to loading, so the header says it is trying again.
  const onReload = useCallback(() => {
    cityCache.current = {}
    setCounts(previous => Object.fromEntries(Object.entries(previous).map(([name, value]) => [name, value === COUNT_UNAVAILABLE ? null : value])))
    const hadFigures = typeof dayFiguresRef.current?.activeToday === 'number'
    if (!hadFigures) setDayFigures({ loading: true, activeToday: null, atStakeToday: null, capped: false })
    return Promise.all([
      loadList(queryRef.current),
      loadCounts(queryRef.current, { silent: true }),
      loadDayFigures({ silent: hadFigures })
    ]).then(() => undefined)
  }, [])

  // ---- counts of the four views, with the active search and filters ----

  // `silent` (Live now's refresh): the numbers on screen stay until the new ones are in, and a count that cannot be read keeps its old value
  const loadCounts = async (query, { silent = false } = {}) => {
    const id = ++countsRequest.current
    const stale = () => id !== countsRequest.current || !mounted.current
    // redesign OC-F2 (OC-Q1-07): letters have no cart number to count by: the counts are those of no search
    // (`buildCartsWhere` only searches by digits), never zero. The list keeps its «Search by cart number» empty state.
    try {
      const resolved = await resolveBusinessIds(query.filters)
      if (stale()) return
      if (resolved.empty) {
        setCounts(ZERO_COUNTS)
        return
      }
      const now = new Date()
      const { root, token: accessToken } = context.current
      const totals = await Promise.all(CART_VIEWS.map(async (name) => {
        try {
          const where = buildCartsWhere({
            view: name,
            search: query.search,
            businessIds: resolved.ids,
            customerIds: query.filters.customerIds,
            lastActivity: query.filters.lastActivity,
            now
          })
          const content = await request(`${root}${buildCartsPath({ page: 1, pageSize: 1, where })}`, jsonOptions(accessToken))
          if (content.error) return null
          return Number(content.pagination?.total ?? (Array.isArray(content.result) ? content.result.length : NaN)) || 0
        } catch (error) {
          return null
        }
      }))
      if (stale()) return
      // a count that cannot be read keeps its old number when silent; otherwise (or with nothing to keep) it is unavailable, never null
      setCounts(previous => Object.fromEntries(CART_VIEWS.map((name, index) => [
        name,
        totals[index] ?? (silent && typeof previous[name] === 'number' ? previous[name] : COUNT_UNAVAILABLE)
      ])))
    } catch (error) {
      if (stale()) return
      // the numbers already on screen stay in a silent reload; every other count is unavailable, never null
      setCounts(previous => (silent
        ? Object.fromEntries(Object.entries(previous).map(([name, value]) => [name, typeof value === 'number' ? value : COUNT_UNAVAILABLE]))
        : UNAVAILABLE_COUNTS))
    }
  }

  // ---- once per visit: controls, rules, figures of today ----

  const loadControls = async () => {
    try {
      const { root, token: accessToken } = context.current
      const content = await request(`${root}/controls/orders`, jsonOptions(accessToken))
      if (!content.error && mounted.current) {
        setControls({ businesses: toList(content.result?.businesses), cities: toList(content.result?.cities) })
      }
    } catch (error) {
      // the selectors stay empty; the list does not depend on them
    }
  }

  const loadRules = async () => {
    try {
      const { root, token: accessToken } = context.current
      const content = await request(`${root}/event_rules?page_size=50`, jsonOptions(accessToken))
      if (!mounted.current) return
      if (content.error) {
        setRules({ loading: false, total: null, enabled: null, error: content.result })
        return
      }
      const abandoned = toList(content.result).filter(rule => rule?.type === 'abandoned_cart')
      setRules({ loading: false, total: abandoned.length, enabled: abandoned.filter(rule => rule.enabled).length })
    } catch (error) {
      if (mounted.current) setRules({ loading: false, total: null, enabled: null, error: errorsOf(error) })
    }
  }

  // redesign OC-F2 (OC-Q1-10): `silent` keeps the figures on screen while they reload and when the reload fails. The local midnight is
  // read at each call, so a day that changed since the last one counts from the new midnight.
  const loadDayFigures = async ({ silent = false } = {}) => {
    const id = ++dayRequest.current
    const stale = () => id !== dayRequest.current || !mounted.current
    try {
      const now = new Date()
      const where = buildCartsWhere({ view: 'all', lastActivity: { from: startOfLocalDay(now), to: null }, now })
      const { root, token: accessToken } = context.current
      const content = await request(
        `${root}${buildCartsPath({ page: 1, pageSize: DAY_FIGURES_CAP, orderBy: '-updated_at', params: totalsParam, where })}`,
        jsonOptions(accessToken)
      )
      if (stale()) return
      if (content.error) {
        if (!silent) setDayFigures({ loading: false, activeToday: null, atStakeToday: null, capped: false, error: content.result })
        return
      }
      const carts = toList(content.result)
      await ensureDetails(seedDetails(carts))
      if (stale()) return
      const totals = {}
      carts.forEach(cart => { totals[cart.id] = cartTotal(detailsRef.current[cart.id]) ?? 0 })
      dayCarts.current = totals
      const total = Number(content.pagination?.total ?? carts.length)
      setDayFigures({
        loading: false,
        activeToday: total,
        atStakeToday: Math.round(Object.values(totals).reduce((sum, value) => sum + value, 0) * 100) / 100,
        capped: total > carts.length
      })
    } catch (error) {
      if (!stale() && !silent) setDayFigures({ loading: false, activeToday: null, atStakeToday: null, capped: false, error: errorsOf(error) })
    }
  }

  // ---- deleting (emptying) a cart ----

  const removeCart = (cart) => {
    const present = sourceRef.current.carts.some(item => item.id === cart.id)
    setSource(previous => {
      const carts = previous.carts.filter(item => item.id !== cart.id)
      return carts.length === previous.carts.length ? previous : { ...previous, carts, total: Math.max(0, previous.total - 1) }
    })
    // redesign OC-A (M-9): the counts go down by one, never to NaN
    if (present) {
      const inViews = viewsOfCart(cart, new Date())
      setCounts(previous => {
        const next = { ...previous }
        inViews.forEach(name => { if (typeof next[name] === 'number') next[name] = Math.max(0, next[name] - 1) })
        return next
      })
    }
    if (dayCarts.current[cart.id] !== undefined) {
      const value = dayCarts.current[cart.id]
      delete dayCarts.current[cart.id]
      setDayFigures(previous => (typeof previous.activeToday === 'number'
        ? { ...previous, activeToday: Math.max(0, previous.activeToday - 1), atStakeToday: Math.round(((previous.atStakeToday || 0) - value) * 100) / 100 }
        : previous))
    }
  }

  /** `POST /carts/clear` empties the customer's cart. Answers { ok, error }; the list changes only on success. */
  const deleteCart = useCallback(async (cart) => {
    try {
      const { root, token: accessToken } = context.current
      const content = await request(`${root}/carts/clear`, jsonOptions(accessToken, 'POST', { user_id: cart.user_id, uuid: cart.uuid }))
      // redesign OC-A (M-8): the API's reason travels back to the dialog
      if (content.error) return { ok: false, error: content.result }
      if (mounted.current) removeCart(cart)
      // redesign OC-F2 (OC-Q1-04): main said it (main's components/OpenCartsDetail, CART_DELETED); the panel closes and the focus moves on
      notify.current(ToastType.Success, cartDeleted.current)
      return { ok: true, error: null }
    } catch (error) {
      return { ok: false, error: errorsOf(error) }
    }
  }, [])

  // ---- handlers: one change, one state update, one request ----

  const onViewChange = useCallback((next) => {
    if (!CART_VIEWS.includes(next)) return
    setView(next)
    setPage(1)
  }, [])

  const onSearchChange = useCallback((text) => {
    const next = String(text ?? '')
    const changes = searchKeyOf(next) !== searchKeyOf(searchRef.current)
    searchRef.current = next
    setSearch(next)
    if (changes) setPage(1)
  }, [])

  const onFiltersChange = useCallback((partial) => {
    const next = normalizeFilters(filtersRef.current, partial)
    if (filtersKey(next) === filtersKey(filtersRef.current)) return
    filtersRef.current = next
    setFilters(next)
    setPage(1)
  }, [])

  // redesign OC-A (M-2): clearing the filters (and the search) loads the unfiltered list again
  const onClearFilters = useCallback(() => {
    const hadSearch = searchKeyOf(searchRef.current) !== ''
    const hadFilters = filtersKey(filtersRef.current) !== filtersKey(EMPTY_FILTERS)
    searchRef.current = ''
    filtersRef.current = EMPTY_FILTERS
    setSearch('')
    setFilters(EMPTY_FILTERS)
    if (hadSearch || hadFilters) setPage(1)
  }, [])

  const onWithContactOnlyChange = useCallback((value) => {
    setWithContactOnly(Boolean(value))
    setPage(1)
  }, [])

  const onPageChange = useCallback((next) => {
    setPage(Math.max(1, parseInt(next, 10) || 1))
  }, [])

  const onPageSizeChange = useCallback((size) => {
    if (!PAGE_SIZES.includes(Number(size))) return
    setPageSize(Number(size))
    setPage(1)
  }, [])

  // ---- effects ----

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      listRequest.current++
      countsRequest.current++
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    loadControls()
    loadRules()
    loadDayFigures()
  }, [ready])

  // The list reloads when what it asks for changes. Follow up pages in the client, so its page,
  // its size and the contact switch are not part of the request.
  const searchKey = searchKeyOf(search)
  const filterKey = filtersKey(filters)
  const listKey = JSON.stringify([view, searchKey, filterKey, ...(view === 'followUp' ? [] : [view === 'live' ? 1 : page, pageSize])])
  useEffect(() => {
    if (!ready) return
    loadList(queryRef.current)
  }, [ready, listKey])

  // redesign OC-F2 (OC-Q1-07): the counts depend on the digits of the search, so letters (and any text with the same digits) ask nothing
  const countsKey = JSON.stringify([searchDigits(search), filterKey])
  useEffect(() => {
    if (!ready) return
    loadCounts(queryRef.current)
  }, [ready, countsKey])

  // Live now: every LIVE_POLL_MS, only with the browser tab in view
  useEffect(() => {
    if (!ready || view !== 'live') return undefined
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refresh()
    }, LIVE_POLL_MS)
    return () => clearInterval(timer)
  }, [ready, view, refresh])

  // A page left empty by deleting its last row goes back one page
  useEffect(() => {
    if (!source.loading && source.view !== 'followUp' && source.view !== 'live' && source.carts.length === 0 && source.total > 0 && page > 1) {
      setPage(page - 1)
    }
  }, [source, page])

  // ---- what the UI receives ----

  const list = useMemo(() => {
    const base = { loading: source.loading, error: source.error, searchWithoutDigits: source.searchWithoutDigits, capped: source.capped }
    if (source.view === 'followUp') {
      const kept = withContactOnly ? source.carts.filter(cart => contactOf(cart).hasContact) : source.carts
      const ranked = rankFollowUp(kept, details, new Date(source.loadedAt ?? Date.now()))
      const ordered = ranked.flatMap(group => group.carts)
      const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize))
      const current = Math.min(Math.max(page, 1), totalPages)
      const visible = ordered.slice((current - 1) * pageSize, current * pageSize)
      const visibleIds = new Set(visible.map(cart => cart.id))
      return {
        ...base,
        carts: visible,
        groups: ranked
          .map(group => ({ key: group.key, carts: group.carts.filter(cart => visibleIds.has(cart.id)) }))
          .filter(group => group.carts.length > 0),
        page: current,
        pageSize,
        total: ordered.length,
        totalPages,
        hiddenCount: source.carts.length - kept.length
      }
    }
    return {
      ...base,
      carts: source.carts,
      groups: null,
      page: source.page,
      pageSize: source.pageSize,
      total: source.total,
      totalPages: source.totalPages,
      hiddenCount: 0
    }
  }, [source, details, withContactOnly, page, pageSize])

  const liveState = useMemo(() => ({ ...live, refresh }), [live, refresh])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          view={view}
          onViewChange={onViewChange}
          search={search}
          onSearchChange={onSearchChange}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          withContactOnly={withContactOnly}
          onWithContactOnlyChange={onWithContactOnlyChange}
          list={list}
          onReload={onReload}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          counts={counts}
          details={details}
          ensureDetails={ensureDetails}
          rules={rules}
          dayFigures={dayFigures}
          live={liveState}
          deleteCart={deleteCart}
          businesses={controls.businesses}
          cities={controls.cities}
        />
      )}
    </>
  )
}

OpenCartListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * The view shown first (`followUp`, `paymentFailed`, `live` or `all`); `followUp` by default
   */
  initialView: PropTypes.oneOf(CART_VIEWS),
  /**
   * redesign OC-F3 (OC-Q1-08): «With contact only» of Follow up on first render; `true` by default (the page reads it from `?contact=`)
   */
  initialWithContactOnly: PropTypes.bool
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
