import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'
import { averageTicket, countCancelled, percentChange, sumRows } from '../../utils/homeMetrics'
import { comparisonPlan, periodOf, sumByNow, zonedNow } from '../../utils/businessReports'

// redesign bi FA1 (D2, D6, D10, BI-07, BI-08, BI-21, auditor 1, 2, 3, 8): the controller of /intelligence/business.
// It asks the reports and computes the figures; the UI only paints them.

/** The zone of the browser, read when asked (a test may change it). */
const BROWSER_ZONE = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Milliseconds a debounced filter change waits for the next one before asking the reports (D6: store and brand checkboxes). */
const FILTER_DEBOUNCE = 600

/** The ten reports of the page, in the order `main` asks them: block key, API report, and the prop the UI receives. */
const BLOCKS = [
  { key: 'orders', type: 'orders', prop: 'ordersList' },
  { key: 'sales', type: 'sales', prop: 'salesList' },
  { key: 'topProduct', type: 'top_selling', prop: 'topProductList' },
  { key: 'topCategory', type: 'top_categories', prop: 'topCategoryList' },
  { key: 'orderStatus', type: 'orders_status', prop: 'orderStatusList' },
  { key: 'registerUsers', type: 'users', prop: 'registerUsersList' },
  { key: 'customerSatisfaction', type: 'customer_satisfaction', prop: 'customerSatisfactionList' },
  { key: 'ordersAcceptSpend', type: 'orders_accept_spend', prop: 'ordersAcceptSpendList' },
  { key: 'arrivedPickUpSpend', type: 'arrived_pickup_spend', prop: 'arrivedPickUpSpendList' },
  { key: 'orderLocation', type: 'order_location', prop: 'orderLocationList' }
]

/** The keys `reloadBlock` accepts. */
export const BUSINESS_ANALYTICS_BLOCK_KEYS = BLOCKS.map(block => block.key)

// A block is found by its key and also by the name of its API report
const BLOCK_LOOKUP = {}
BLOCKS.forEach((block) => {
  BLOCK_LOOKUP[block.key] = block
  BLOCK_LOOKUP[block.type] = block
})

const LOCATIONS_TYPE = 'order_location'

// redesign bi FA1 (BI-08: every block is born loading, so the UI reserves the final box from the first paint)
const emptyBlock = (block, patch) => ({
  loading: true,
  data: [],
  ...(block.type === LOCATIONS_TYPE ? { locations: [] } : {}),
  error: null,
  ...patch
})

const initialBlocks = () => Object.fromEntries(BLOCKS.map(block => [block.key, emptyBlock(block)]))

const NO_FIGURES = { orders: null, sales: null, users: null, averageTicket: null }

/** The reports a whole period is compared with: its orders, sales and users, and the statuses that tell the cancelled orders (AK-282). */
const COMPARED_TYPES = ['orders', 'sales', 'users', 'orders_status']

// these two reports are asked without the cancelled and failed orders (`exclude_cancelled`). An API that applied it answers
// `exclude_cancelled: true` next to `result`; one deployed before the parameter ignores it and the figures keep the base
const WITHOUT_CANCELLED = ['orders', 'sales']
const appliedExclusion = (body) => body?.exclude_cancelled === true

const isReady = (block) => !block.loading && block.error == null

/** Seconds of `orders_accept_spend` / `arrived_pickup_spend` (a number or a text), or null when there is none. */
const secondsOf = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const seconds = Number(value)
    return Number.isFinite(seconds) ? seconds : null
  }
  return null
}

const percentOrNull = (current, previous) => (current === null || previous === null ? null : percentChange(current, previous))

const changeBetween = (current, previous) => ({
  orders: percentOrNull(current.orders, previous.orders),
  sales: percentOrNull(current.sales, previous.sales),
  users: percentOrNull(current.users, previous.users),
  averageTicket: percentOrNull(current.averageTicket, previous.averageTicket)
})

// (tanda AK, AK-282): a figure and the one it is compared with always share a base. `orders_status` gives the
// cancelled orders of a whole range, so a period compared with another whole range counts its orders without them; «by now»
// has no breakdown by hour (the API refuses a lapse with hours), so Today keeps them and says so. Sales carry no status, so
// the average ticket keeps the cancelled orders in both terms. all of this is the fallback for an API that does not
// answer `exclude_cancelled: true`; when it does, orders, sales and ticket leave the cancelled orders out in every mode.
export const ORDERS_BASE = { excludesCancelled: 'excludesCancelled', includesCancelled: 'includesCancelled' }
const ordersBaseOf = (plan) => (plan?.mode === 'byNow' ? ORDERS_BASE.includesCancelled : ORDERS_BASE.excludesCancelled)

const baseOf = (excluded) => (excluded ? ORDERS_BASE.excludesCancelled : ORDERS_BASE.includesCancelled)

// `excluded` says which reports the API answered without the cancelled orders. Orders it left out are not subtracted
// again; over a whole period the orders figure leaves them out either way. The ticket needs both terms in one base, or it is null
const figuresOf = (orders, sales, users, status, excluded = {}) => ({
  orders: excluded.orders ? sumRows(orders, 'orders') : Math.max(0, sumRows(orders, 'orders') - countCancelled(status)),
  sales: sumRows(sales, 'sales'),
  users: sumRows(users, 'users'),
  averageTicket: Boolean(excluded.orders) === Boolean(excluded.sales) ? averageTicket(sumRows(sales, 'sales'), sumRows(orders, 'orders')) : null
})
const wholePeriodBases = (excluded) => ({ orders: ORDERS_BASE.excludesCancelled, sales: baseOf(excluded.sales) })

/**
 * figures in different bases are not compared. A key whose base differs between the period and the one it is compared
 * with has no previous figure (and so no change); the ticket follows the base of sales. An unknown base (still loading) compares.
 */
const alignBases = (previous, previousBases, currentBases) => {
  if (!previous || !previousBases || !currentBases) return previous
  const aligned = { ...previous }
  const differs = (key) => currentBases[key] != null && previousBases[key] != null && currentBases[key] !== previousBases[key]
  if (differs('orders')) aligned.orders = null
  if (differs('sales')) {
    aligned.sales = null
    aligned.averageTicket = null
  }
  return aligned
}

/**
 * Component to manage the Business Intelligence page behavior without UI component
 */
export const BusinessAnalytics = (props) => {
  const {
    UIComponent
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  // The latest session and api, read by the loaders so they never depend on their identity
  const context = useRef({})
  context.current = { root: ordering?.root, token, sessionLoading: loading }

  const mounted = useRef(true)
  // One counter per block (and one for the comparison): a response only writes if no newer request of its own was made
  const requests = useRef({})
  // (review AK-R1): the filters each block's data was asked with, written with the data, so a figure is read in the base
  // of the period it belongs to and not in the one just picked, whose data is still on its way
  const askedWith = useRef({})
  const timer = useRef(null)

  const [filterList, setFilterList] = useState({ lapse: 'today', businessIds: null, app_id: 'all', franchises_id: null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  // redesign bi FA1 (D6, BI-21): the filters the reports are asked with; the pills (`filterList`) change at once, this one after the debounce
  const [applied, setApplied] = useState(filterList)
  const latestFilters = useRef(filterList)
  const appliedRef = useRef(applied)
  appliedRef.current = applied

  const [blocks, setBlocks] = useState(initialBlocks)
  const [comparisonState, setComparisonState] = useState({ loading: true, error: null, plan: null, previous: null, current: null, longRange: false })
  const [countryCode, setCountryCode] = useState('')

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const handleChangeCode = (code) => {
    if (code === countryCode) setCountryCode('')
    else setCountryCode(code)
  }

  const paramsForAPI = (type, filters, lapse = filters?.lapse) => {
    const rootUrl = `${context.current.root}/reports/${type}`
    let params = `lapse=${lapse}&timezone=${normalizeTimezone(filters?.timeZone)}`
    if (filters?.businessIds && filters?.businessIds.length > 0) params = `${params}&businesses=${filters?.businessIds?.toString()}`
    if (filters?.app_id && filters.app_id !== 'all') params = `${params}&app_id=${filters?.app_id}`
    if (filters?.franchises_id && filters?.franchises_id.length > 0) params = `${params}&franchises_id=${JSON.stringify(filters?.franchises_id)}`
    if (WITHOUT_CANCELLED.includes(type)) params = `${params}&exclude_cancelled=1`

    return `${rootUrl}?${params}`
  }

  /** GET one report; resolves with the API envelope `{ error, result }` of the body, as `main` reads it. */
  const getReport = async (type, filters, lapse) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.current.token}`
      }
    }
    const response = await fetch(paramsForAPI(type, filters, lapse), requestOptions)
    return response.json()
  }

  /**
   * Method to get one block (orders, sales, top products...). Nothing is asked while the session loads.
   * A success clears the error; a failure leaves empty data and the error (BI-07).
   */
  const loadBlock = useCallback(async (key, filters = appliedRef.current) => {
    const block = BLOCK_LOOKUP[key]
    if (!block || context.current.sessionLoading) return
    const id = (requests.current[block.key] || 0) + 1
    requests.current[block.key] = id
    const isCurrent = () => mounted.current && requests.current[block.key] === id
    const write = (patch) => setBlocks(previous => ({ ...previous, [block.key]: patch(previous[block.key]) }))

    write(previous => ({ ...previous, loading: true }))
    try {
      const body = await getReport(block.type, filters)
      const { error, result } = body
      if (!isCurrent()) return
      askedWith.current[block.key] = filters
      if (!error) {
        write(() => emptyBlock(block, {
          loading: false,
          data: result,
          ...(appliedExclusion(body) ? { excludesCancelled: true } : {}),
          ...(block.type === LOCATIONS_TYPE ? { locations: result } : {})
        }))
      } else {
        write(() => emptyBlock(block, { loading: false, error: result }))
      }
    } catch (err) {
      if (!isCurrent()) return
      askedWith.current[block.key] = filters
      write(() => emptyBlock(block, { loading: false, error: err }))
    }
  }, [])

  const reloadBlock = useCallback((key) => loadBlock(key, appliedRef.current), [loadBlock])

  /**
   * Method to get the figures of the period to compare with (D2, auditor 1). It never touches the blocks:
   * a failing comparison sets its own error.
   */
  const loadComparison = useCallback(async (filters = appliedRef.current) => {
    if (context.current.sessionLoading) return
    const id = (requests.current.comparison || 0) + 1
    requests.current.comparison = id
    const isCurrent = () => mounted.current && requests.current.comparison === id

    // redesign bi R1 (F1): «now» is the wall clock of the zone the reports are asked in, so the days and the hour follow it
    const now = zonedNow(filters.timeZone)
    const plan = comparisonPlan(filters.lapse, now)
    const longRange = periodOf(filters.lapse, now).granularity === 'month'
    setComparisonState(previous => ({ ...previous, loading: true, error: null, plan, longRange }))

    // the lapses whose orders and sales the API answered without the cancelled ones
    const answered = new Set()
    const rowsOf = async (type, lapse) => {
      const body = await getReport(type, filters, lapse)
      const { error, result } = body
      if (error) throw Object.assign(new Error('Report error'), { result })
      if (WITHOUT_CANCELLED.includes(type) && appliedExclusion(body)) answered.add(`${type}|${lapse}`)
      return Array.isArray(result) ? result : []
    }
    const excludedIn = (lapse) => ({ orders: answered.has(`orders|${lapse}`), sales: answered.has(`sales|${lapse}`) })
    try {
      let previousFigures
      let currentFigures = null
      let previousBases
      let currentBases = null
      if (plan.mode === 'byNow') {
        const day = plan.previous.split(',')[0]
        const [orders, sales] = await Promise.all([rowsOf('orders', plan.previous), rowsOf('sales', plan.previous)])
        const byNowOrders = sumByNow(orders, 'orders', plan.hour, day)
        const byNowSales = sumByNow(sales, 'sales', plan.hour, day)
        const excluded = excludedIn(plan.previous)
        previousFigures = {
          orders: byNowOrders,
          sales: byNowSales,
          users: null,
          // redesign bi integration (D2): the ticket of yesterday by this time, from the same hours (in one base)
          averageTicket: excluded.orders === excluded.sales ? averageTicket(byNowSales, byNowOrders) : null
        }
        previousBases = { orders: baseOf(excluded.orders), sales: baseOf(excluded.sales) }
      } else if (plan.mode === 'previous') {
        const [orders, sales, users, status] = await Promise.all(COMPARED_TYPES.map(type => rowsOf(type, plan.previous)))
        previousFigures = figuresOf(orders, sales, users, status, excludedIn(plan.previous))
        previousBases = wholePeriodBases(excludedIn(plan.previous))
      } else {
        const [currentOrders, currentSales, currentUsers, currentStatus, orders, sales, users, status] = await Promise.all([
          ...COMPARED_TYPES.map(type => rowsOf(type, plan.current)),
          ...COMPARED_TYPES.map(type => rowsOf(type, plan.previous))
        ])
        currentFigures = figuresOf(currentOrders, currentSales, currentUsers, currentStatus, excludedIn(plan.current))
        previousFigures = figuresOf(orders, sales, users, status, excludedIn(plan.previous))
        currentBases = wholePeriodBases(excludedIn(plan.current))
        previousBases = wholePeriodBases(excludedIn(plan.previous))
      }
      if (!isCurrent()) return
      setComparisonState({
        loading: false, error: null, plan, previous: previousFigures, current: currentFigures, longRange, previousBases, currentBases
      })
    } catch (err) {
      if (!isCurrent()) return
      setComparisonState({ loading: false, error: err?.result ?? err, plan, previous: null, current: null, longRange })
    }
  }, [])

  // redesign bi FA1 (BI-21): one load per change of the applied filters, and one when the session finishes loading
  useEffect(() => {
    if (loading) return
    BLOCKS.forEach(block => loadBlock(block.key, applied))
    loadComparison(applied)
  }, [applied, loading])

  /**
   * Changes the filters. The pills see it at once; the reports are asked at once too, unless `debounce` is set
   * (D6: the checkboxes of stores and brands), which waits 600 ms after the last change.
   */
  const handleChangeFilterList = useCallback((next, options) => {
    const value = typeof next === 'function' ? next(latestFilters.current) : next
    latestFilters.current = value
    setFilterList(value)
    clearTimeout(timer.current)
    if (options?.debounce) {
      timer.current = setTimeout(() => {
        if (mounted.current) setApplied(latestFilters.current)
      }, FILTER_DEBOUNCE)
    } else {
      setApplied(value)
    }
  }, [])

  const reloadComparison = useCallback(() => loadComparison(appliedRef.current), [loadComparison])

  const totals = useMemo(() => {
    const seconds = (block) => (isReady(block) ? secondsOf(block.data) : null)
    const allOrders = isReady(blocks.orders) ? sumRows(blocks.orders.data, 'orders') : null
    const sales = isReady(blocks.sales) ? sumRows(blocks.sales.data, 'sales') : null
    // (AK-282): the base of the orders figure follows the lapse its orders were asked with, as its comparison does;
    // without cancelled orders the statuses must be those of the same request (review AK-R1)
    // orders the API already answered without the cancelled ones are the figure as they come, «by now» included
    const ordersExcluded = isReady(blocks.orders) && blocks.orders.excludesCancelled === true
    const salesExcluded = isReady(blocks.sales) && blocks.sales.excludesCancelled === true
    const asked = askedWith.current.orders ?? applied
    const ordersBase = ordersExcluded ? ORDERS_BASE.excludesCancelled : ordersBaseOf(comparisonPlan(asked.lapse, zonedNow(asked.timeZone)))
    let orders = allOrders
    if (ordersBase === ORDERS_BASE.excludesCancelled && !ordersExcluded) {
      const sameRequest = isReady(blocks.orderStatus) && askedWith.current.orderStatus === asked
      orders = allOrders === null || !sameRequest ? null : Math.max(0, allOrders - countCancelled(blocks.orderStatus.data))
    }
    return {
      orders,
      ordersBase,
      sales,
      users: isReady(blocks.registerUsers) ? sumRows(blocks.registerUsers.data, 'users') : null,
      // both terms in the same base: never sales without the cancelled orders over orders with them, or the other way round
      averageTicket: allOrders === null || sales === null || ordersExcluded !== salesExcluded ? null : averageTicket(sales, allOrders),
      acceptSeconds: seconds(blocks.ordersAcceptSpend),
      pickupSeconds: seconds(blocks.arrivedPickUpSpend)
    }
  }, [blocks, applied])

  // redesign bi FA1 (D2): the percentage is derived, so it follows both the blocks and the comparison whichever arrives last
  const comparison = useMemo(() => {
    const { loading: comparing, error, plan, current, longRange, previousBases, currentBases } = comparisonState
    // a closed period is compared with its own figures; the others with the blocks on screen, whose base is unknown
    // (null) while they load
    const blockBases = {
      orders: isReady(blocks.orders) ? totals.ordersBase : null,
      sales: isReady(blocks.sales) ? baseOf(blocks.sales.excludesCancelled === true) : null
    }
    const previous = alignBases(comparisonState.previous, previousBases, plan?.mode === 'closed' ? currentBases : blockBases)
    let change = NO_FIGURES
    // No percentage in Today (nothing to compare with by now), for a previous of 0 (percentChange), nor for ranges the API groups by month
    if (!comparing && !error && plan && previous && !longRange) {
      if (plan.mode === 'previous') change = changeBetween(totals, previous)
      else if (plan.mode === 'closed') change = changeBetween(current, previous)
    }
    return { loading: comparing, error, plan, previous: previous ?? NO_FIGURES, current, change }
  }, [comparisonState, totals, blocks])

  // redesign bi R1 (F1): the period is read in the zone of the pills, which change at once
  // redesign bi R1 targeted (N2): and again on every load (`applied` is a new object then), so a reload after midnight moves it
  const period = useMemo(() => periodOf(filterList.lapse, zonedNow(filterList.timeZone)), [filterList.lapse, filterList.timeZone, applied])
  // redesign bi R1 targeted (N1): the API labels its rows the same whatever `timezone` it gets (measured: Tokyo «today» brings
  // `2026-10-09 13:00:00`, the row Chicago gets), so the day of another zone spans two days of labels and no axis of that zone
  // fits them. The continuous axis (D7) is kept for the browser's zone, where the labels were measured; with another zone the
  // chart gets `chartPeriod: null` and draws the rows as they come, as `main` did. Which zone `time` comes in is a question for
  // backend (decisions.md P10)
  const chartPeriod = useMemo(() => (
    normalizeTimezone(filterList.timeZone) === normalizeTimezone(BROWSER_ZONE()) ? periodOf(filterList.lapse) : null
  ), [filterList.lapse, filterList.timeZone, applied])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          filterList={filterList}
          {...Object.fromEntries(BLOCKS.map(block => [block.prop, blocks[block.key]]))}
          reloadBlock={reloadBlock}
          comparison={comparison}
          reloadComparison={reloadComparison}
          totals={totals}
          period={period}
          chartPeriod={chartPeriod}
          handleChangeFilterList={handleChangeFilterList}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
      )}
    </>
  )
}

BusinessAnalytics.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
