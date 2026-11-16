import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'
import { sumRows } from '../../utils/homeMetrics'
import { periodOf, zonedNow } from '../../utils/businessReports'
import { pairsByAt, periodOfChartReport, rowsOfChartReport, secondsOf, seriesOfChartReport, spendSeries as spendSeriesOf, topDriverItems } from '../../utils/driverReports'

// redesign drivers FB (D2, D5, D9, DR-01, DR-12, DR-13, DR-19): the controller of /intelligence/drivers, with the pattern of BusinessAnalytics.
// It asks the reports and computes the figures; the UI only paints them. There is no comparison with the previous period (D2).

/** Milliseconds a debounced filter change waits for the next one before asking the reports (D6: store and brand checkboxes). */
const FILTER_DEBOUNCE = 600

/** The fourteen reports of the page, in the order `main` asks them: block key, API report, and the prop the UI receives. */
const BLOCKS = [
  { key: 'orders', type: 'driver_orders_v2', prop: 'ordersList' },
  { key: 'sales', type: 'driver_sales_v2', prop: 'salesList' },
  { key: 'orderStatus', type: 'drivers_orders_status', prop: 'orderStatusList' },
  { key: 'topDrivers', type: 'drivers_top_orders', prop: 'topDriversList' },
  { key: 'spendTimes', type: 'drivers_spend_times', prop: 'spendTimesList' },
  { key: 'availableTimes', type: 'drivers_available_times', prop: 'availableTimesList' },
  { key: 'busyTimes', type: 'drivers_busy_times', prop: 'busyTimesList' },
  { key: 'customerSatisfaction', type: 'customer_satisfaction', prop: 'customerSatisfactionList' },
  { key: 'acceptSpend', type: 'drivers_accept_spend', prop: 'acceptSpendList' },
  { key: 'completeSpend', type: 'drivers_complete_spend', prop: 'completeSpendList' },
  { key: 'arrivedPickUpSpend', type: 'drivers_arrived_pickup_spend', prop: 'arrivedPickUpSpendList' },
  { key: 'pickUpSpend', type: 'drivers_pickup_spend', prop: 'pickUpSpendList' },
  { key: 'orderLocation', type: 'drivers_order_location', prop: 'orderLocationList' },
  { key: 'deliverySpend', type: 'drivers_delivery_spend', prop: 'deliverySpendList' }
]

/** The keys `reloadBlock` accepts. */
export const DRIVER_ANALYTICS_BLOCK_KEYS = BLOCKS.map(block => block.key)

// A block is found by its key and also by the name of its API report
const BLOCK_LOOKUP = {}
BLOCKS.forEach((block) => {
  BLOCK_LOOKUP[block.key] = block
  BLOCK_LOOKUP[block.type] = block
})

const LOCATIONS_TYPE = 'drivers_order_location'
const V2_TYPES = ['driver_orders_v2', 'driver_sales_v2']

// redesign drivers FB (DR-01: every block is born loading, so the UI reserves the final box from the first paint)
const emptyBlock = (block, patch) => ({
  loading: true,
  data: [],
  ...(block.type === LOCATIONS_TYPE ? { locations: [] } : {}),
  error: null,
  ...patch
})

const initialBlocks = () => Object.fromEntries(BLOCKS.map(block => [block.key, emptyBlock(block)]))

const isReady = (block) => !block.loading && block.error == null

/** A non-empty list of ids, or null: an empty array is never sent (DR-13). */
const idsOf = (ids) => (Array.isArray(ids) && ids.length > 0 ? ids : null)

/**
 * Component to manage the Driver Intelligence page behavior without UI component
 */
export const DriverAnalytics = (props) => {
  const {
    UIComponent
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  // The latest session and api, read by the loaders so they never depend on their identity
  const context = useRef({})
  context.current = { root: ordering?.root, token, sessionLoading: loading }

  const mounted = useRef(true)
  // One counter per block: a response only writes if no newer request of its own was made (DR-12)
  const requests = useRef({})
  const timer = useRef(null)

  // redesign drivers FB (D5): the drivers live in `drivers_ids`, the key of the kit pills, and are sent as `drivers=`
  const [filterList, setFilterList] = useState({
    lapse: 'today',
    drivers_ids: null,
    businessIds: null,
    app_id: 'all',
    driver_groups_ids: null,
    franchises_id: null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  // The filters the reports are asked with; the pills (`filterList`) change at once, this one after the debounce
  const [applied, setApplied] = useState(filterList)
  const latestFilters = useRef(filterList)
  const appliedRef = useRef(applied)
  appliedRef.current = applied

  const [blocks, setBlocks] = useState(initialBlocks)
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

  const paramsForAPI = (type, filters) => {
    const rootUrl = `${context.current.root}/reports/${type}`
    let params = `lapse=${filters?.lapse}&timezone=${normalizeTimezone(filters?.timeZone)}`
    // redesign drivers FB (DR-13): a list with no ids is not sent
    const drivers = idsOf(filters?.drivers_ids)
    if (drivers) params = `${params}&drivers=${drivers.toString()}`
    const businesses = idsOf(filters?.businessIds)
    if (businesses) params = `${params}&businesses=${businesses.toString()}`
    if (filters?.app_id && filters.app_id !== 'all') params = `${params}&app_id=${filters?.app_id}`
    const groups = idsOf(filters?.driver_groups_ids)
    if (groups) params = `${params}&driver_groups_ids=${JSON.stringify(groups)}`
    const franchises = idsOf(filters?.franchises_id)
    if (franchises) params = `${params}&franchises_id=${JSON.stringify(franchises)}`
    // the v2 reports ignore `drivers=` / `businesses=`; they read these JSON lists instead
    if (V2_TYPES.includes(type)) {
      if (drivers) params = `${params}&drivers_ids=${JSON.stringify(drivers)}`
      if (businesses) params = `${params}&businesses_ids=${JSON.stringify(businesses)}`
    }

    return `${rootUrl}?${params}`
  }

  /** GET one report; resolves with the API envelope `{ error, result }` of the body, as `main` reads it. */
  const getReport = async (type, filters) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.current.token}`
      }
    }
    const response = await fetch(paramsForAPI(type, filters), requestOptions)
    return response.json()
  }

  /**
   * Method to get one block (orders, sales, top drivers...). Nothing is asked while the session loads.
   * A success clears the error; a failure leaves empty data, loading off and the error (DR-01).
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
      const { error, result } = await getReport(block.type, filters)
      if (!isCurrent()) return
      if (!error) {
        write(() => emptyBlock(block, {
          loading: false,
          data: result,
          ...(block.type === LOCATIONS_TYPE ? { locations: result } : {})
        }))
      } else {
        write(() => emptyBlock(block, { loading: false, error: result }))
      }
    } catch (err) {
      if (!isCurrent()) return
      write(() => emptyBlock(block, { loading: false, error: err }))
    }
  }, [])

  const reloadBlock = useCallback((key) => loadBlock(key, appliedRef.current), [loadBlock])

  // One load per change of the applied filters, and one when the session finishes loading
  useEffect(() => {
    if (loading) return
    BLOCKS.forEach(block => loadBlock(block.key, applied))
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

  // redesign drivers FB (D6, DR-19): the rows and series the cards draw, computed once from the blocks that are ready
  // redesign drivers FB (phase-1 audit): `*Rows` are the first series (totals and CSV, as main); `*Series` are all of them (main draws every series)
  const ordersRows = useMemo(() => (isReady(blocks.orders) ? rowsOfChartReport(blocks.orders.data, 'orders') : []), [blocks.orders])
  const salesRows = useMemo(() => (isReady(blocks.sales) ? rowsOfChartReport(blocks.sales.data, 'sales') : []), [blocks.sales])
  const ordersSeries = useMemo(() => (isReady(blocks.orders) ? seriesOfChartReport(blocks.orders.data, 'orders') : []), [blocks.orders])
  const salesSeries = useMemo(() => (isReady(blocks.sales) ? seriesOfChartReport(blocks.sales.data, 'sales') : []), [blocks.sales])
  // redesign drivers FB (phase-1 audit): the axis of each chart follows the range its own response carries, not the zone
  const ordersPeriod = useMemo(() => (isReady(blocks.orders) ? periodOfChartReport(blocks.orders.data) : null), [blocks.orders])
  const salesPeriod = useMemo(() => (isReady(blocks.sales) ? periodOfChartReport(blocks.sales.data) : null), [blocks.sales])
  const spendSeries = useMemo(() => (isReady(blocks.spendTimes) ? spendSeriesOf(blocks.spendTimes.data) : []), [blocks.spendTimes])
  const availablePairs = useMemo(() => (isReady(blocks.availableTimes) ? pairsByAt(blocks.availableTimes.data, 'available', 'not_available') : []), [blocks.availableTimes])
  const busyPairs = useMemo(() => (isReady(blocks.busyTimes) ? pairsByAt(blocks.busyTimes.data, 'busy', 'not_busy') : []), [blocks.busyTimes])
  const topDrivers = useMemo(() => (isReady(blocks.topDrivers) ? topDriverItems(blocks.topDrivers.data) : []), [blocks.topDrivers])

  const totals = useMemo(() => {
    const seconds = (block) => (isReady(block) ? secondsOf(block.data) : null)
    return {
      orders: isReady(blocks.orders) ? sumRows(ordersRows, 'orders') : null,
      sales: isReady(blocks.sales) ? sumRows(salesRows, 'sales') : null,
      acceptSeconds: seconds(blocks.acceptSpend),
      arrivedSeconds: seconds(blocks.arrivedPickUpSpend),
      pickupSeconds: seconds(blocks.pickUpSpend),
      deliverySeconds: seconds(blocks.deliverySpend),
      completeSeconds: seconds(blocks.completeSpend)
    }
  }, [blocks, ordersRows, salesRows])

  // The period is read in the zone of the pills, which change at once; and again on every load (`applied` is a new object then)
  const period = useMemo(() => periodOf(filterList.lapse, zonedNow(filterList.timeZone)), [filterList.lapse, filterList.timeZone, applied])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          filterList={filterList}
          {...Object.fromEntries(BLOCKS.map(block => [block.prop, blocks[block.key]]))}
          reloadBlock={reloadBlock}
          totals={totals}
          ordersRows={ordersRows}
          salesRows={salesRows}
          ordersSeries={ordersSeries}
          salesSeries={salesSeries}
          ordersPeriod={ordersPeriod}
          salesPeriod={salesPeriod}
          spendSeries={spendSeries}
          availablePairs={availablePairs}
          busyPairs={busyPairs}
          topDrivers={topDrivers}
          period={period}
          handleChangeFilterList={handleChangeFilterList}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
      )}
    </>
  )
}

DriverAnalytics.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
