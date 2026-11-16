import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useLanguage } from '../../contexts/LanguageContext'
import {
  buildBusinessInvoice,
  buildDriverInvoice,
  businessOrdersWhere,
  driverOrdersWhere,
  orderSubtotal,
  orderTotal,
  serverFilterIds
} from '../../utils/invoiceMath'
import { monthOf, shiftDay, todayDay } from '../../utils/dateRange'

// redesign invoice FA (D5, D6, D7, D8, auditor 1, 3, 4): the one controller of /intelligence/invoice, for a business
// invoice (`kind='business'`) and a driver invoice (`kind='driver'`). It makes the requests of `InvoiceBusinessManager` and
// `InvoiceDriverManager` of `main` (same URLs and parameters), asks the orders live and passes the UIComponent the
// form, the lists, the orders and the invoice. It renders no markup. The arithmetic lives in `utils/invoiceMath`.
// `kind` is read when the component mounts: to change it, mount another one (the page keeps one per kind).

/** Rows per page of the businesses list (BC:24). */
const BUSINESSES_PAGE_SIZE = 10

/** Milliseconds between the last change of the filters that go to the server and the orders request (D5). */
const ORDERS_WAIT = 400

// the batch. Each party costs one GET /orders per page and one POST /pdf/html. dompdf 3.1.6 (api-core's) took 20 ms for an
// invoice of 10 orders, 70 ms for 50 and 280 ms for 200, the same per PDF in runs of 5 and of 20; the route has no rate limit.
// 50 parties, 2 at a time, stay around a minute even at 2 s per party (orders + PDF + network).
/** The most businesses or drivers a batch takes. */
export const INVOICE_BATCH_LIMIT = 50
/** How many parties of a batch are in flight at once. */
export const INVOICE_BATCH_CONCURRENCY = 2
const RETRYABLE = ['error', 'cancelled']

/** The most pages of GET /orders one invoice reads; past it the invoice says it is incomplete («truncated»). */
export const MAX_ORDER_PAGES = 50

/**
 * GET /orders with `where`, every page (review: one request read only the first page and the invoice came out short).
 * The first request is the one of `main`; the next ones add `page`. `cancelToken` is the SDK's (each request puts its `cancel` on it)
 * and `live()` is asked before each next page. Resolves to `null` when it stopped, `{ error, result }` on a failure, or
 * `{ orders, truncated }` (`{ received, total }` when the server has more than was read).
 */
const loadAllOrders = async (api, where, { cancelToken, live }) => {
  const get = async (page) => {
    const { content } = await api.orders().asDashboard().where(where).get(page === 1 ? { cancelToken } : { cancelToken, query: { page } })
    return content
  }
  const first = await get(1)
  if (first.error) return { error: first.result || true }
  let orders = Array.isArray(first.result) ? first.result : []
  const total = Number(first.pagination?.total)
  const pageSize = Number(first.pagination?.page_size)
  // without total_pages or page_size there is no way to ask the next page: the first one is all, as in `main`
  const pages = Number(first.pagination?.total_pages) || (pageSize > 0 ? Math.ceil(total / pageSize) : 1)
  for (let page = 2; page <= Math.min(pages, MAX_ORDER_PAGES) && orders.length < total; page++) {
    if (!live()) return null
    const next = await get(page)
    if (next.error) return { error: next.result || true }
    const rows = Array.isArray(next.result) ? next.result : []
    if (!rows.length) break
    orders = orders.concat(rows)
  }
  return { orders, truncated: total > orders.length ? { received: orders.length, total } : null }
}

// redesign (D-23): the period starts on «Last month» of the local day, not «All dates» (`main` billed the whole history)
const lastMonth = () => {
  const end = shiftDay(monthOf(todayDay()), -1)
  return { from: monthOf(end), to: end }
}

/** The form each kind starts with: the values of `main` (BC:49-62, DC:25-38) without the id of the business or driver, and «Last month». */
const defaultForm = (kind) => kind === 'driver'
  ? {
      ...lastMonth(),
      cancelled: false,
      notes: '',
      percentage_fee: 0,
      fixed_fee: 0,
      percentage_delivery_price: 0,
      percentage_driver_tip: 0,
      tax: 0,
      misc_amount: 0,
      misc_description: ''
    }
  : {
      type: 'charge',
      ...lastMonth(),
      cancelled: false,
      discounts: false,
      notes: '',
      percentage_fee: 0,
      fixed_fee: 0,
      tax: 0,
      misc_amount: 0,
      misc_description: ''
    }

/** BC:76-86. D13 kept: the map hides nothing (every value is true and it is tested with `!== false`). */
const filterPaymethods = (paymethods) => {
  const _paymethods = {
    apple_pay: true,
    google_pay: true,
    global_apple_pay: true,
    global_google_pay: true,
    stripe_connect: true
  }

  return paymethods?.filter?.(p => p.enabled && (_paymethods[p.gateway] !== false))
}

const toParty = (item) => ({ id: item.id, name: item.name })

const isEnabledWallet = (config) => config?.value === '1'

/**
 * Component to manage the invoice builder behavior without UI component
 */
export const InvoiceBuilder = (props) => {
  const { kind, UIComponent } = props
  const isBusiness = kind !== 'driver'

  const [ordering] = useApi()
  const [{ token, loading: sessionLoading, user }] = useSession()
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()

  // The latest session and api, read by the loaders so they never depend on their identity
  const context = useRef({})
  context.current = { ordering, token, user }

  const mounted = useRef(true)
  const started = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // ---- the form ----------------------------------------------------------------------------------------------
  const [form, setForm] = useState(() => defaultForm(kind))
  const setField = useCallback((name, value) => setForm(prev => ({ ...prev, [name]: value })), [])
  const setPeriod = useCallback((from, to) => setForm(prev => ({ ...prev, from: from ?? '', to: to ?? '' })), [])

  // ---- the business or the driver ----------------------------------------------------------------------------
  const [partyList, setPartyList] = useState({ loading: false, items: [], error: null, page: 1, totalPages: null })
  const [search, setSearchValue] = useState('')
  const [selected, setSelected] = useState(null)
  const partyRequest = useRef(0)
  const searchRef = useRef('')
  const pageSizeRef = useRef(BUSINESSES_PAGE_SIZE)

  /** GET the businesses (BC:94-148): the endpoint of `main` for level 0 and the SDK for the rest; `name` is the only extra field. */
  const loadBusinesses = useCallback(async (page = 1, searchText = '') => {
    const id = ++partyRequest.current
    try {
      setPartyList(prev => ({ ...prev, loading: true }))
      const { ordering: api, token: bearer, user: sessionUser } = context.current
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSizeRef.current) >= 1 ? Number(pageSizeRef.current) : BUSINESSES_PAGE_SIZE
      const propsToFetch = ['name']

      const conditions = []
      if (searchText && String(searchText).trim()) {
        conditions.push({
          attribute: 'name',
          value: { condition: 'ilike', value: encodeURI(`%${String(searchText).trim()}%`) }
        })
      }

      let content = null
      if (sessionUser?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }
        }
        const whereObj = conditions.length ? JSON.stringify({ conditions, conector: 'AND' }) : ''
        const whereParam = whereObj ? `&where=${whereObj}` : ''
        const params = Array.from(new Set(['id', ...propsToFetch])).join(',')
        const response = await fetch(
          `${api.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          requestOptions
        )
        content = await response.json()
      } else {
        let fetchEndpoint = api.businesses().asDashboard().select(propsToFetch)
        if (conditions.length) {
          fetchEndpoint = fetchEndpoint.where({ conditions, conector: 'AND' })
        }
        const response = await fetchEndpoint.get({ query: { page: safePage, page_size: safePageSize } })
        content = response.content
      }
      if (!mounted.current || id !== partyRequest.current) return
      const { error, result, pagination } = content || {}
      if (!error) {
        if (pagination?.page_size) pageSizeRef.current = pagination.page_size
        setPartyList({
          loading: false,
          items: (result || []).map(toParty),
          error: null,
          page: pagination?.current_page ?? safePage,
          totalPages: pagination?.total_pages ?? null
        })
      } else {
        setPartyList(prev => ({ ...prev, loading: false, error: result || true }))
      }
    } catch (error) {
      if (!mounted.current || id !== partyRequest.current) return
      setPartyList(prev => ({ ...prev, loading: false, error: [error] }))
    }
  }, [])

  /** GET the drivers (DC:52-81): id and name, with no page as in `main`. Levels 4 and 5: driver managers can be billed too (row 2, D-26). */
  const loadDrivers = useCallback(async () => {
    const id = ++partyRequest.current
    try {
      setPartyList(prev => ({ ...prev, loading: true }))
      const where = [{ attribute: 'level', value: [4, 5] }]
      const { content: { error, result } } = await context.current.ordering.users().asDashboard().select(['id', 'name']).where(where).get()
      if (!mounted.current || id !== partyRequest.current) return
      if (!error) {
        setPartyList(prev => ({ ...prev, loading: false, items: (result || []).map(toParty), error: null }))
      } else {
        setPartyList(prev => ({ ...prev, loading: false, error: result || true }))
      }
    } catch (error) {
      if (!mounted.current || id !== partyRequest.current) return
      setPartyList(prev => ({ ...prev, loading: false, error: [error] }))
    }
  }, [])

  /** `searchBusinesses` of `main` (BC:150-155): trims, goes back to page 1 and asks. */
  const setSearch = useCallback((text) => {
    const normalized = text == null ? '' : String(text).trim()
    searchRef.current = normalized
    setSearchValue(normalized)
    loadBusinesses(1, normalized)
  }, [loadBusinesses])

  /** `handleChangeBusinessPage` of `main` (BC:157-159). */
  const goToPage = useCallback((page) => {
    loadBusinesses(page, searchRef.current)
  }, [loadBusinesses])

  const select = useCallback((item) => setSelected(item ? toParty(item) : null), [])

  const retryParty = useCallback(() => {
    if (isBusiness) loadBusinesses(partyList.page, searchRef.current)
    else loadDrivers()
  }, [isBusiness, loadBusinesses, loadDrivers, partyList.page])

  // ---- the payment methods -----------------------------------------------------------------------------------
  const [payState, setPayState] = useState({ loading: false, error: null, list: [], loaded: false })
  const [uncheckedPay, setUncheckedPay] = useState([])
  const payRequest = useRef(0)

  /** GET /paymethods (BC:164-194, DC:86-123): the business hides nothing (D13), the driver keeps the enabled ones. */
  const loadPayMethods = useCallback(async () => {
    const id = ++payRequest.current
    try {
      setPayState(prev => ({ ...prev, loading: true }))
      const { ordering: api, token: bearer } = context.current
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`
        }
      }
      const response = await fetch(`${api.root}/paymethods`, requestOptions)
      const { error, result } = await response.json()
      if (!mounted.current || id !== payRequest.current) return
      if (!error) {
        const list = (isBusiness ? filterPaymethods(result) : result.filter(item => item.enabled)) || []
        setPayState({ loading: false, error: null, list, loaded: true })
      } else {
        setPayState(prev => ({ ...prev, loading: false, error: result || true }))
      }
    } catch (error) {
      if (!mounted.current || id !== payRequest.current) return
      setPayState(prev => ({ ...prev, loading: false, error }))
    }
  }, [isBusiness])

  const payItems = useMemo(() => payState.list.map(method => ({
    id: method.id,
    name: method.name,
    gateway: method.gateway,
    checked: !uncheckedPay.includes(method.id)
  })), [payState.list, uncheckedPay])

  const togglePay = useCallback((payId) => {
    setUncheckedPay(prev => prev.includes(payId) ? prev.filter(item => item !== payId) : [...prev, payId])
  }, [])

  const setAllPay = useCallback((checked) => {
    setUncheckedPay(checked ? [] : payState.list.map(method => method.id))
  }, [payState.list])

  // ---- the order types (business only) -----------------------------------------------------------------------
  const [uncheckedTypes, setUncheckedTypes] = useState([])
  const allowedTypes = configs?.order_types_allowed?.value

  // As `main` (BC:486-489), a change of the allowed types checks them all again
  useEffect(() => {
    setUncheckedTypes(prev => prev.length ? [] : prev)
  }, [allowedTypes])

  const typeItems = useMemo(() => {
    if (!isBusiness) return null
    // D22 fixed: without `order_types_allowed` every type is offered; `main` offered none and billed 0 orders.
    const configTypes = allowedTypes ? allowedTypes.split('|').map(value => Number(value)) : [1, 2, 3, 4, 5]
    const defaultOrderTypes = [
      { value: 1, name: t('DELIVERY', 'Delivery') },
      { value: 2, name: t('PICKUP', 'Pickup') },
      { value: 3, name: t('EAT_IN', 'Eat in') },
      { value: 4, name: t('CURBSIDE', 'Curbside') },
      { value: 5, name: t('DRIVE_THRU', 'Drive thru') }
    ]
    return defaultOrderTypes
      .filter(type => configTypes.includes(type.value))
      .map(type => ({ ...type, checked: !uncheckedTypes.includes(type.value) }))
  }, [isBusiness, allowedTypes, uncheckedTypes, t])

  const toggleType = useCallback((value) => {
    setUncheckedTypes(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value])
  }, [])

  const setAllTypes = useCallback((checked) => {
    setUncheckedTypes(checked ? [] : (typeItems || []).map(item => item.value))
  }, [typeItems])

  // ---- what blocks the orders --------------------------------------------------------------------------------
  const configReady = !!configs && Object.keys(configs).length > 0
  // redesign invoice R2 (P4): a project with no enabled payment method is not a failed setup: main calculated anyway, with the client filter on
  // an empty list. A failed /paymethods leaves `loaded` false (and `error` set), so it stays blocked as 'setup' and the preview says why.
  const setupReady = configReady && payState.loaded
  let blocked = null
  if (!selected) blocked = 'no_party'
  else if (!setupReady) blocked = 'setup'
  else if (isBusiness && !typeItems.some(item => item.checked)) blocked = 'no_order_types'

  // ---- the orders request (D5) -------------------------------------------------------------------------------
  // The `where` is also the key of a load: what the server is asked decides if the orders on screen are the ones of the form
  const paymethodIds = serverFilterIds(payItems, 'id')
  const deliveryTypeIds = isBusiness ? serverFilterIds(typeItems, 'value') : []
  let where = null
  if (selected) {
    where = isBusiness
      ? businessOrdersWhere({ businessId: selected.id, from: form.from, to: form.to, deliveryTypeIds, paymethodIds })
      : driverOrdersWhere({ driverId: selected.id, from: form.from, to: form.to, paymethodIds })
  }
  const whereKey = where ? JSON.stringify(where) : null
  const whereRef = useRef(where)
  whereRef.current = where

  const [request, setRequest] = useState({ status: 'idle', key: null, error: null })
  const [data, setData] = useState({ raw: null, key: null, truncated: null })
  const ordersRequest = useRef(0)
  const cancelToken = useRef(null)

  /** GET the orders of `main` (BC:245, DC:166). A response of an older request is discarded; the older request is cancelled if the SDK allows it. */
  const loadOrders = useCallback(async (key, ordersWhere) => {
    const id = ++ordersRequest.current
    const previous = cancelToken.current
    if (previous && typeof previous.cancel === 'function') {
      try {
        previous.cancel()
      } catch (error) {
        // a request that cannot be cancelled is still discarded by its identifier
      }
    }
    const token = {}
    cancelToken.current = token
    setRequest({ status: 'loading', key, error: null })
    try {
      const live = () => mounted.current && id === ordersRequest.current
      const loaded = await loadAllOrders(context.current.ordering, ordersWhere, { cancelToken: token, live })
      if (!loaded || !live()) return
      if (!loaded.error) {
        setData({ raw: loaded.orders, key, truncated: loaded.truncated })
        setRequest({ status: 'ready', key, error: null })
      } else {
        setRequest({ status: 'error', key, error: loaded.error })
      }
    } catch (error) {
      if (!mounted.current || id !== ordersRequest.current) return
      setRequest({ status: 'error', key, error: [error] })
    }
  }, [])

  // The wait: 400 ms after the last change of the party, the period or the ids that are sent, and only with the setup loaded
  useEffect(() => {
    if (blocked || !whereKey || request.key === whereKey) return undefined
    const timer = setTimeout(() => loadOrders(whereKey, whereRef.current), ORDERS_WAIT)
    return () => clearTimeout(timer)
  }, [blocked, whereKey, request.key, loadOrders])

  const retryOrders = useCallback(() => {
    if (whereRef.current) loadOrders(JSON.stringify(whereRef.current), whereRef.current)
  }, [loadOrders])

  // ---- the first requests (D18 of main: it gave up when the session was still loading) ------------------------
  useEffect(() => {
    if (sessionLoading || started.current) return
    started.current = true
    if (isBusiness) loadBusinesses(1, '')
    else loadDrivers()
    loadPayMethods()
  }, [sessionLoading, isBusiness, loadBusinesses, loadDrivers, loadPayMethods])

  // ---- the invoice -------------------------------------------------------------------------------------------
  const decimals = configs?.format_number_decimal_length?.value
  const walletEnabled = isEnabledWallet(configs?.wallet_cash_enabled) || isEnabledWallet(configs?.wallet_credit_point_enabled)

  // Changes that are not sent to the server (cancelled, discounts, type, fees, tax, misc, notes) only recalculate this
  const computed = useMemo(() => {
    if (blocked === 'no_party' || blocked === 'setup') return { invoice: null, error: null }
    // With no order type checked main would count 0 orders; nothing is asked
    const rawOrders = blocked === 'no_order_types' ? [] : data.raw
    if (!rawOrders) return { invoice: null, error: null }
    try {
      const invoice = isBusiness
        ? buildBusinessInvoice({ orders: rawOrders, form, payMethods: payItems, orderTypes: typeItems, business: selected, decimals })
        : buildDriverInvoice({ orders: rawOrders, form, payMethods: payItems, driver: selected, decimals, walletEnabled })
      return { invoice, error: null }
    } catch (error) {
      return { invoice: null, error }
    }
  }, [blocked, data.raw, form, payItems, typeItems, selected, decimals, walletEnabled, isBusiness])

  // ---- the batch ----------------------------------------------------------------------------------
  // One invoice per chosen party with the form of the page: the same where, the same orders request and the same builder as
  // the single invoice. The form is read when a run starts, and a retry reuses it, so one batch never mixes two forms.
  const [batchSelected, setBatchSelected] = useState([])
  const [batchItems, setBatchItems] = useState([])
  const [batchRunning, setBatchRunning] = useState(false)
  const batchAbort = useRef(null)
  const batchInputs = useRef(null)
  const batchForm = { form, payItems, typeItems, paymethodIds, deliveryTypeIds, decimals, walletEnabled }
  const batchFormRef = useRef(batchForm)
  batchFormRef.current = batchForm

  let batchBlocked = null
  if (!setupReady) batchBlocked = 'setup'
  else if (isBusiness && !typeItems.some(item => item.checked)) batchBlocked = 'no_order_types'

  const toggleBatch = useCallback((item, next) => setBatchSelected(prev => {
    const has = prev.some(party => party.id === item.id)
    if (next === false || (next == null && has)) return prev.filter(party => party.id !== item.id)
    if (has || prev.length >= INVOICE_BATCH_LIMIT) return prev
    return [...prev, toParty(item)]
  }), [])

  const selectAllBatch = useCallback((items) => setBatchSelected(prev => {
    const ids = new Set(prev.map(party => party.id))
    return [...prev, ...(items || []).filter(item => !ids.has(item.id)).map(toParty)].slice(0, INVOICE_BATCH_LIMIT)
  }), [])

  const clearBatch = useCallback(() => setBatchSelected([]), [])

  const patchBatch = (id, change) => setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...change } : item))

  /** Runs `parties` with `inputs`, `INVOICE_BATCH_CONCURRENCY` at a time. `makePdf(invoice, party, signal)` resolves to `{ blob, filename }`. */
  const runBatch = async (makePdf, inputs, parties) => {
    const controller = new AbortController()
    batchAbort.current = controller
    setBatchRunning(true)
    const { signal } = controller
    const live = () => mounted.current && !signal.aborted

    const work = async (party) => {
      const token = {}
      const stop = () => {
        try {
          token.cancel?.()
        } catch (error) {
          // a request that cannot be cancelled is still discarded by `live()`
        }
      }
      signal.addEventListener('abort', stop)
      patchBatch(party.id, { status: 'running', error: null })
      try {
        const where = isBusiness
          ? businessOrdersWhere({ businessId: party.id, from: inputs.form.from, to: inputs.form.to, deliveryTypeIds: inputs.deliveryTypeIds, paymethodIds: inputs.paymethodIds })
          : driverOrdersWhere({ driverId: party.id, from: inputs.form.from, to: inputs.form.to, paymethodIds: inputs.paymethodIds })
        const loaded = await loadAllOrders(context.current.ordering, where, { cancelToken: token, live })
        if (!loaded || !live()) return
        if (loaded.error) {
          patchBatch(party.id, { status: 'error', error: loaded.error })
          return
        }
        const { orders: received, truncated } = loaded
        const invoice = isBusiness
          ? buildBusinessInvoice({ orders: received, form: inputs.form, payMethods: inputs.payItems, orderTypes: inputs.typeItems, business: party, decimals: inputs.decimals })
          : buildDriverInvoice({ orders: received, form: inputs.form, payMethods: inputs.payItems, driver: party, decimals: inputs.decimals, walletEnabled: inputs.walletEnabled })
        if (!invoice.orders?.length) {
          patchBatch(party.id, { status: 'empty', invoice, truncated, pdf: null })
          return
        }
        const pdf = await makePdf(invoice, party, signal)
        if (!live()) return
        patchBatch(party.id, { status: 'done', invoice, truncated, pdf })
      } catch (error) {
        if (live()) patchBatch(party.id, { status: 'error', error: [error] })
      } finally {
        signal.removeEventListener('abort', stop)
      }
    }

    const queue = [...parties]
    const worker = async () => {
      while (queue.length && live()) await work(queue.shift())
    }
    await Promise.all(Array.from({ length: Math.min(INVOICE_BATCH_CONCURRENCY, queue.length) }, worker))
    if (mounted.current && batchAbort.current === controller) {
      batchAbort.current = null
      setBatchRunning(false)
    }
  }

  const startBatch = (makePdf) => {
    if (batchBlocked || batchAbort.current || !batchSelected.length) return
    batchInputs.current = batchFormRef.current
    setBatchItems(batchSelected.map(party => ({ ...party, status: 'queued', error: null, invoice: null, truncated: null, pdf: null })))
    runBatch(makePdf, batchInputs.current, batchSelected)
  }

  /** With `id`, that party again; without it, every party that failed or was cancelled. */
  const retryBatch = (makePdf, id) => {
    if (batchAbort.current || !batchInputs.current) return
    const targets = batchItems.filter(item => id == null ? RETRYABLE.includes(item.status) : item.id === id)
    if (!targets.length) return
    const ids = targets.map(item => item.id)
    setBatchItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'queued', error: null } : item))
    runBatch(makePdf, batchInputs.current, targets.map(toParty))
  }

  /** Stops at once: what is in flight is cancelled and discarded, what waits is not asked. */
  const cancelBatch = () => {
    const controller = batchAbort.current
    if (!controller) return
    batchAbort.current = null
    controller.abort()
    setBatchRunning(false)
    setBatchItems(prev => prev.map(item => (item.status === 'queued' || item.status === 'running') ? { ...item, status: 'cancelled' } : item))
  }

  // Leaving the page stops the batch
  useEffect(() => () => batchAbort.current?.abort(), [])

  const getSubtotal = useCallback((order) => orderSubtotal(order, decimals), [decimals])
  const getTotal = useCallback((order) => orderTotal(order, decimals), [decimals])

  // ---- the state the UI reads --------------------------------------------------------------------------------
  const pending = !blocked && whereKey !== null && request.key !== whereKey
  const inFlight = request.status === 'loading'
  // redesign invoice FA (D13): with no order type checked, main still produced an invoice of 0 orders that could be downloaded
  const noOrderTypes = blocked === 'no_order_types'
  let status
  if (noOrderTypes) status = computed.error ? 'error' : 'ready'
  else if (blocked) status = 'idle'
  else if (computed.error) status = 'error'
  else if (pending || inFlight) status = 'loading'
  else if (request.status === 'error') status = 'error'
  else status = data.raw ? 'ready' : 'loading'

  const updating = !blocked && (pending || inFlight) && data.raw !== null
  // auditor 4: only the last finished load, for the key of the form, with nothing pending, can be downloaded
  const canDownload = noOrderTypes
    ? status === 'ready' && computed.invoice !== null
    : status === 'ready' && !pending && data.key === whereKey && request.status === 'ready' && computed.invoice !== null

  let ordersError = null
  if (status === 'error') ordersError = computed.error ? [computed.error] : request.error

  const party = {
    kind: isBusiness ? 'business' : 'driver',
    items: partyList.items,
    loading: partyList.loading,
    error: partyList.error,
    selected,
    select,
    retry: retryParty,
    ...(isBusiness ? { page: partyList.page, totalPages: partyList.totalPages, search, setSearch, goToPage } : {})
  }

  const payMethods = {
    loading: payState.loading,
    error: payState.error,
    retry: loadPayMethods,
    items: payItems,
    toggle: togglePay,
    setAll: setAllPay
  }

  const orderTypes = isBusiness ? { items: typeItems, toggle: toggleType, setAll: setAllTypes } : null

  const orders = {
    status,
    error: ordersError,
    retry: retryOrders,
    raw: data.raw || [],
    truncated: data.truncated,
    blocked
  }

  const batch = {
    limit: INVOICE_BATCH_LIMIT,
    selected: batchSelected,
    toggle: toggleBatch,
    selectAll: selectAllBatch,
    clear: clearBatch,
    items: batchItems,
    running: batchRunning,
    blocked: batchBlocked,
    run: startBatch,
    retry: retryBatch,
    cancel: cancelBatch
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          kind={isBusiness ? 'business' : 'driver'}
          form={form}
          setField={setField}
          setPeriod={setPeriod}
          party={party}
          payMethods={payMethods}
          orderTypes={orderTypes}
          orders={orders}
          invoice={computed.invoice}
          updating={updating}
          canDownload={canDownload}
          getSubtotal={getSubtotal}
          getTotal={getTotal}
          batch={batch}
        />
      )}
    </>
  )
}

InvoiceBuilder.propTypes = {
  /**
   * 'business' or 'driver'
   */
  kind: PropTypes.oneOf(['business', 'driver']).isRequired,
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
