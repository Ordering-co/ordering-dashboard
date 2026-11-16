import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'
import {
  HOME_ATTENTION_KEYS,
  averageTicket,
  buildAttentionWhere,
  buildFailedCartsPath,
  countCancelled,
  dailySeries,
  evaluateSetupGuide,
  getHomeDays,
  percentChange,
  sumRows,
  sumUntilHour
} from '../../utils/homeMetrics'

// redesign home FB (D2, D4, D5, D9, HM-01, HM-11, HM-14, auditor 5, 6, 8, 9, 10): the controller of the new Home.
// It computes the figures; the UI only paints them.

const GUIDE_STORES_PAGE_SIZE = 50
const GUIDE_PAYMETHODS_STORES = 5

const toArray = (value) => (Array.isArray(value) ? value : [])
const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0)

/** Message of an API error (`result` is a list of messages) or of a thrown error; never empty. */
const toMessage = (error) => {
  const result = error?.result ?? error?.message ?? error
  const text = Array.isArray(result) ? result.join(', ') : String(result ?? '')
  return text || 'Error'
}

const guideStorageKey = (project, userId) => `odc-home-guide-hidden:${project}:${userId}`

// redesign home R1 (Q-03): whether the last visit to this project (and user) had the guide, to reserve its card from the first paint
const eligibleStorageKey = (project, userId) => `odc-home-guide-eligible:${project}:${userId}`

const readFlag = (key) => {
  try {
    return Boolean(window.localStorage.getItem(key))
  } catch (error) {
    return false
  }
}

/**
 * Component to manage Home page behavior without UI component
 */
export const Home = (props) => {
  const {
    UIComponent,
    attentionKeys,
    sites
  } = props
  const [{ token, user, loading: sessionLoading }] = useSession()
  const [ordering] = useApi()

  // The latest session and api, read by the loaders so they never depend on their identity
  const context = useRef({})
  context.current = { root: ordering?.root, token, level: user?.level }

  const mounted = useRef(true)
  const requests = useRef({ today: 0, trend: 0, attention: 0, guide: 0 })
  const guideRequested = useRef(false)

  const attentionList = useMemo(() => {
    const keys = Array.isArray(attentionKeys) ? attentionKeys : []
    return HOME_ATTENTION_KEYS.filter(key => keys.includes(key))
  }, [Array.isArray(attentionKeys) ? attentionKeys.join(',') : ''])

  const initialDays = useMemo(() => getHomeDays(), [])
  const [calendar, setCalendar] = useState({ today: initialDays.today, monthStart: initialDays.monthStart })
  const [todayState, setTodayState] = useState({
    loading: true,
    error: null,
    sales: 0,
    orders: 0,
    cancelled: 0,
    excludesCancelled: { sales: false, orders: false },
    averageTicket: null,
    lastWeek: {
      day: initialDays.lastWeekDay,
      byNow: { sales: 0, orders: 0 },
      fullDay: { sales: 0, orders: 0, cancelled: 0, averageTicket: null }
    }
  })
  const [trendState, setTrendState] = useState({ loading: true, error: null, days: [], current: [], previous: [] })
  const [attentionState, setAttentionState] = useState({ loading: attentionList.length > 0, error: null, counts: {} })
  const [guideData, setGuideData] = useState({ loading: false, error: null, loaded: false, businesses: [], paymethodsByBusiness: {}, driversTotal: 0 })

  const storageKey = guideStorageKey(ordering?.project, user?.id)
  const [hidden, setHidden] = useState(() => readFlag(storageKey))

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setHidden(readFlag(storageKey))
  }, [storageKey])

  // redesign home R1 (Q-03): the memory of the last visit's eligibility (same storage rules as the hidden flag)
  const eligibleKey = eligibleStorageKey(ordering?.project, user?.id)
  const [remembered, setRemembered] = useState(() => readFlag(eligibleKey))
  useEffect(() => {
    setRemembered(readFlag(eligibleKey))
  }, [eligibleKey])

  /** GET `${root}${path}` as JSON; an API error (`error: true`) throws with its messages. */
  const getJson = async (path) => {
    const { root, token: accessToken } = context.current
    const response = await fetch(`${root}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    })
    const content = await response.json()
    if (content?.error) throw Object.assign(new Error(toMessage(content.result)), { result: content.result })
    return content
  }

  // redesign home FB (D5, HM-11): the browser time zone on every report, as Business Intelligence does
  // sales and orders are asked without the cancelled orders; `excludesCancelled` is true only when the API says it applied it
  const getReportOf = async (type, lapse) => {
    const timezone = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const withoutCancelled = type === 'sales' || type === 'orders' ? '&exclude_cancelled=1' : ''
    const content = await getJson(`/reports/${type}?lapse=${lapse}${timezone ? `&timezone=${timezone}` : ''}${withoutCancelled}`)
    return { rows: toArray(content.result), excludesCancelled: content?.exclude_cancelled === true }
  }
  const getReport = async (type, lapse) => (await getReportOf(type, lapse)).rows

  const loadToday = useCallback(async () => {
    const id = ++requests.current.today
    const stale = () => id !== requests.current.today || !mounted.current
    const days = getHomeDays()
    const lastWeek = `${days.lastWeekDay},${days.lastWeekDay}`
    setTodayState(previous => ({ ...previous, loading: true, error: null }))
    try {
      const [salesOf, ordersOf, lastWeekSalesOf, lastWeekOrdersOf, status, lastWeekStatus] = await Promise.all([
        getReportOf('sales', 'today'),
        getReportOf('orders', 'today'),
        getReportOf('sales', lastWeek),
        getReportOf('orders', lastWeek),
        getReport('orders_status', 'today'),
        getReport('orders_status', lastWeek)
      ])
      if (stale()) return
      const [sales, orders, lastWeekSales, lastWeekOrders] = [salesOf, ordersOf, lastWeekSalesOf, lastWeekOrdersOf].map(report => report.rows)
      // each figure is in the base the API answered it in. A reference in another base than its figure is not shown (null),
      // nor a ticket whose two terms differ: never a figure with the cancelled orders next to one without them
      const excludesCancelled = { sales: salesOf.excludesCancelled, orders: ordersOf.excludesCancelled }
      const lastWeekExcludes = { sales: lastWeekSalesOf.excludesCancelled, orders: lastWeekOrdersOf.excludesCancelled }
      const sameSales = excludesCancelled.sales === lastWeekExcludes.sales
      const sameOrders = excludesCancelled.orders === lastWeekExcludes.orders
      const totalSales = sumRows(sales, 'sales')
      const totalOrders = sumRows(orders, 'orders')
      // Only the rows of that day count «by now»: a bucket stamped the next midnight is the end of the day, not its start
      const ofLastWeekDay = (rows) => rows.filter(row => String(row?.time ?? '').slice(0, 10) === days.lastWeekDay)
      const fullSales = sumRows(lastWeekSales, 'sales')
      const fullOrders = sumRows(lastWeekOrders, 'orders')
      setTodayState({
        loading: false,
        error: null,
        sales: totalSales,
        orders: totalOrders,
        cancelled: countCancelled(status),
        excludesCancelled,
        averageTicket: excludesCancelled.sales === excludesCancelled.orders ? averageTicket(totalSales, totalOrders) : null,
        lastWeek: {
          day: days.lastWeekDay,
          byNow: {
            sales: sameSales ? sumUntilHour(ofLastWeekDay(lastWeekSales), 'sales', days.hour) : null,
            orders: sameOrders ? sumUntilHour(ofLastWeekDay(lastWeekOrders), 'orders', days.hour) : null
          },
          fullDay: {
            sales: sameSales ? fullSales : null,
            orders: sameOrders ? fullOrders : null,
            cancelled: countCancelled(lastWeekStatus),
            averageTicket: sameSales && sameOrders && lastWeekExcludes.sales === lastWeekExcludes.orders ? averageTicket(fullSales, fullOrders) : null
          }
        }
      })
    } catch (error) {
      if (stale()) return
      setTodayState(previous => ({ ...previous, loading: false, error: toMessage(error) }))
    }
  }, [])

  const loadTrend = useCallback(async () => {
    const id = ++requests.current.trend
    const stale = () => id !== requests.current.trend || !mounted.current
    const days = getHomeDays()
    setTrendState(previous => ({ ...previous, loading: true, error: null }))
    try {
      // A range of more than 31 days answers by month, so the 30 days and the 30 before are two requests
      const [currentOf, previousOf] = await Promise.all([
        getReportOf('sales', `${days.trendFrom},${days.trendTo}`),
        getReportOf('sales', `${days.previousFrom},${days.previousTo}`)
      ])
      if (stale()) return
      const current = dailySeries(currentOf.rows, days.trendFrom, days.trendTo, 'sales')
      // 30 days in another base than the 30 before are not compared: no previous series, so no change
      const previous = currentOf.excludesCancelled === previousOf.excludesCancelled
        ? dailySeries(previousOf.rows, days.previousFrom, days.previousTo, 'sales')
        : []
      setCalendar({ today: days.today, monthStart: days.monthStart })
      setTrendState({
        loading: false,
        error: null,
        days: current.map(item => item.day),
        current: current.map(item => item.value),
        previous: previous.map(item => item.value),
        excludesCancelled: currentOf.excludesCancelled
      })
    } catch (error) {
      if (stale()) return
      // HM-14: a failing report never leaves the block loading
      setTrendState(previous => ({ ...previous, loading: false, error: toMessage(error) }))
    }
  }, [])

  const loadAttention = useCallback(async () => {
    const id = ++requests.current.attention
    const stale = () => id !== requests.current.attention || !mounted.current
    if (!attentionList.length) {
      setAttentionState({ loading: false, error: null, counts: {} })
      return
    }
    setAttentionState(previous => ({ ...previous, loading: true, error: null }))
    const countOf = async (key) => {
      const path = key === 'failedCarts'
        ? buildFailedCartsPath()
        : `/orders?mode=dashboard&params=id&page=1&page_size=1&where=${encodeURIComponent(JSON.stringify(buildAttentionWhere(key)))}`
      const content = await getJson(path)
      return Number(content.pagination?.total) || 0
    }
    const results = await Promise.allSettled(attentionList.map(countOf))
    if (stale()) return
    const counts = {}
    let failure = null
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') counts[attentionList[index]] = result.value
      else failure = failure || toMessage(result.reason)
    })
    setAttentionState({ loading: false, error: failure, counts })
  }, [attentionList])

  // redesign home FB (D9, auditor 9, 10): asked only on a project without orders
  const loadGuide = useCallback(async () => {
    const id = ++requests.current.guide
    const stale = () => id !== requests.current.guide || !mounted.current
    setGuideData(previous => ({ ...previous, loading: true, error: null }))
    try {
      const stores = toArray((await getJson(`/business?mode=dashboard&params=id,name,enabled,menus_count,zones&page=1&page_size=${GUIDE_STORES_PAGE_SIZE}`)).result)
      // The enabled stores first; the sort is stable, so the API order is kept inside each group
      const sample = [...stores]
        .sort((a, b) => Number(b?.enabled === true) - Number(a?.enabled === true))
        .slice(0, GUIDE_PAYMETHODS_STORES)
      const level = Number(context.current.level)
      const usersWhere = encodeURIComponent(JSON.stringify({ conditions: [{ attribute: 'level', value: [4] }], conector: 'AND' }))
      const [lists, driversTotal] = await Promise.all([
        Promise.all(sample.map(async (store) => {
          try {
            const content = await getJson(`/business/${store.id}/paymethods?params=sites,devices`)
            return [store.id, toArray(content.result)]
          } catch (error) {
            return [store.id, []]
          }
        })),
        level === 0
          ? getJson(`/users?params=id&page=1&page_size=1&where=${usersWhere}`)
            .then(content => Number(content.pagination?.total) || 0)
            .catch(() => 0)
          : Promise.resolve(0)
      ])
      if (stale()) return
      setGuideData({
        loading: false,
        error: null,
        loaded: true,
        businesses: stores,
        paymethodsByBusiness: Object.fromEntries(lists),
        driversTotal
      })
    } catch (error) {
      if (stale()) return
      setGuideData(previous => ({ ...previous, loading: false, error: toMessage(error) }))
    }
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    loadToday()
    loadTrend()
  }, [sessionLoading])

  useEffect(() => {
    if (sessionLoading) return
    loadAttention()
  }, [sessionLoading, loadAttention])

  // Derived, so the month figure follows both today and the trend whichever arrives last
  const trend = useMemo(() => {
    const loaded = !trendState.loading && !trendState.error
    const total = sum(trendState.current)
    const previousTotal = sum(trendState.previous)
    const todayLoaded = !todayState.loading && !todayState.error
    return {
      ...trendState,
      total,
      previousTotal,
      change: loaded ? percentChange(total, previousTotal) : null,
      // the days of the month and today's sales in one base, or no month figure
      monthTotal: loaded && todayLoaded && Boolean(trendState.excludesCancelled) === Boolean(todayState.excludesCancelled?.sales)
        ? sum(trendState.current.filter((value, index) => trendState.days[index] >= calendar.monthStart)) + todayState.sales
        : null
    }
  }, [trendState, todayState, calendar])

  // n.º 13 (owner decision, W1): Intercom's project_sales_last_30_days is the last 30 days, no longer the current month.
  // It is the 30 closed days of the trend window, the same days whose sum is Home's 30-day total; today (a partial day) stays out so the
  // window is exactly 30 days and matches that total. No new request.
  // TYPE CONSTRAINT: Intercom fixes a custom attribute's type on first receipt, so the shape does not change: an array of
  // `{ time: 'YYYY-MM-DD 00:00:00', sales: number }`, as `main` sent. Only the window changed.
  // redesign home FB (auditor 5, HM-14): a load that is not done, or failed, still carries nothing to send (the consumer waits on both).
  const last30SalesList = useMemo(() => {
    const error = trendState.error || todayState.error
    if (error) return { loading: false, error, sales: [] }
    if (trendState.loading || todayState.loading) return { loading: true, error: null, sales: [] }
    const sales = trendState.days
      .map((day, index) => ({ time: `${day} 00:00:00`, sales: trendState.current[index] }))
      // As in `main`, only the days with sales: the API sends no row for a day without them (Intercom gets the same list)
      .filter(item => Number(item.sales) > 0)
    return { loading: false, error: null, sales }
  }, [trendState, todayState])

  const eligible = !trendState.loading && !trendState.error &&
    !todayState.loading && !todayState.error &&
    sum(trendState.current) === 0 && todayState.orders === 0

  useEffect(() => {
    if (!eligible || guideRequested.current) return
    guideRequested.current = true
    loadGuide()
  }, [eligible, loadGuide])

  // redesign home R1 (Q-03): remember an eligible visit; forget it once the reports are in and the project is no longer eligible
  const reportsLoading = trendState.loading || todayState.loading
  useEffect(() => {
    if (sessionLoading || reportsLoading) return
    try {
      if (eligible) window.localStorage.setItem(eligibleKey, '1')
      else window.localStorage.removeItem(eligibleKey)
    } catch (error) {
      // no storage: nothing is remembered
    }
  }, [sessionLoading, reportsLoading, eligible, eligibleKey])

  const guide = useMemo(() => {
    const evaluated = eligible && guideData.loaded
      ? evaluateSetupGuide({
        level: user?.level,
        businesses: guideData.businesses,
        paymethodsByBusiness: guideData.paymethodsByBusiness,
        driversTotal: guideData.driversTotal,
        sites
      })
      : { steps: [], doneCount: 0, requiredCount: 0 }
    return {
      loading: eligible && guideData.loading,
      error: eligible ? guideData.error : null,
      eligible,
      // redesign home R1 (Q-03): what was remembered while today and the trend load, the real eligibility after
      expected: reportsLoading ? remembered : eligible,
      hidden,
      ...evaluated
    }
  }, [eligible, reportsLoading, remembered, guideData, hidden, user?.level, sites])

  // redesign home FB (D3): «Hide guide» lives in this browser only; a storage that throws never breaks the page
  const hideGuide = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch (error) {
      // no storage: it stays hidden for this visit only
    }
    setHidden(true)
  }, [storageKey])

  const showGuide = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch (error) {
      // no storage: nothing to clear
    }
    setHidden(false)
  }, [storageKey])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          today={todayState}
          reloadToday={loadToday}
          trend={trend}
          reloadTrend={loadTrend}
          last30SalesList={last30SalesList}
          attention={attentionState}
          reloadAttention={loadAttention}
          guide={guide}
          hideGuide={hideGuide}
          showGuide={showGuide}
        />
      )}
    </>
  )
}

Home.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Rows of «Needs attention» to count: a subset of HOME_ATTENTION_KEYS (the UI filters it with the user's menu)
   */
  attentionKeys: PropTypes.arrayOf(PropTypes.string),
  /**
   * Sites of the project (from useSite), to know whether an own domain is published
   */
  sites: PropTypes.array
}
