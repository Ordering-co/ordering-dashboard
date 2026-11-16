import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'
import { addDays, resolveTimeZone, todayIn } from '../../utils/timeZone'

const DRIVER_PROPS = ['id', 'enabled', 'available', 'busy', 'driver_groups.id', 'driver_groups.name']
const GROUP_PARAMS = 'id,name,business'
// (row 29, driver-store-status P-4): every active store, so the ones in no delivery group are listed too. The dashboard
// mode answers them all in one page (/business?mode=dashboard&params=id,name,enabled&where=[{"attribute":"enabled","value":true}]).
const BUSINESS_PROPS = ['id', 'name', 'enabled']
const ACTIVE_BUSINESSES = [{ attribute: 'enabled', value: true }]
const BASE_ORDER_OR = {
  conector: 'OR',
  conditions: [
    { attribute: 'has_items', value: { condition: '=', value: true } },
    { attribute: 'cloned_order_id', value: { condition: '!=', value: null } },
    { attribute: 'delivery_type', value: { condition: '=', value: 9 } }
  ]
}
const ORDER_SELECT = ['id', 'business_id', 'driver_id', 'status', 'delivery_datetime', 'delivery_type', 'cloned_order_id', 'has_items']
const DRIVER_ASSIGNED = { attribute: 'driver_id', value: { condition: '>=', value: 0 } }
const DRIVER_UNASSIGNED = { attribute: 'driver_id', value: { condition: '=', value: null } }
const ACTIVE_STATUSES = [0, 7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26]
// (review M4): the /deliveries «In progress» group (C/components/OrdersManage/index.js:37, inProgress). The active statuses above are
// that group plus 0 (pending, same file :36), so the active orders outside it are the ones the Pending tab holds.
const IN_PROGRESS_STATUSES = [7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26]
const FINISHED_STATUSES = [1, 11, 15]
const DELIVERY_TYPES = [1, 7] // only delivery orders are «Active unassigned» (as /orders' delivery-only filter)

const countByBusiness = (orders) => {
  const map = new Map()
  for (const order of orders || []) {
    if (order.business_id == null) continue
    map.set(order.business_id, (map.get(order.business_id) || 0) + 1)
  }
  return map
}

// «today» is the day of `zone` (the user's, as /orders' Today). The orders are compared by `delivery_datetime`, the wall
// clock of their store, as the API filters it; a browser Date with those digits keeps the comparison in wall clock.
const todayRange = (zone) => {
  const day = todayIn(zone)
  return { from: `${day} 00:00:00`, to: `${day} 23:59:59` }
}

// «Active unassigned» spans yesterday 00:00:00 (the overdue) to today 23:59:59
const activeRange = (zone) => {
  const day = todayIn(zone)
  return { from: `${addDays(day, -1)} 00:00:00`, to: `${day} 23:59:59` }
}

const wallTime = (datetime) => new Date(datetime.replace(' ', 'T')).getTime()

const todayBounds = (zone) => {
  const { from, to } = todayRange(zone)
  return { start: wallTime(from), end: wallTime(to) + 999, yesterdayStart: wallTime(activeRange(zone).from) }
}

const groupHasActiveStore = (group) =>
  (group?.business || group?.businesses || []).some(business => business?.enabled)

const isGiftCardOrder = (order) => order?.products?.[0]?.type === 'gift_card'

const isBaseOrder = (order) =>
  order?.has_items === true ||
  (Array.isArray(order?.products) && order.products.length > 0) ||
  order?.cloned_order_id != null ||
  order?.delivery_type === 9

const orderTimestamp = (order) => {
  const value = order?.delivery_datetime
  return value ? new Date(String(value).replace(' ', 'T')).getTime() : NaN
}

const isActiveOrder = (order, yesterdayStart, todayEnd) =>
  !isGiftCardOrder(order) &&
  isBaseOrder(order) &&
  DELIVERY_TYPES.includes(Number(order?.delivery_type)) &&
  ACTIVE_STATUSES.includes(Number(order?.status)) &&
  order?.driver_id == null &&
  orderTimestamp(order) >= yesterdayStart &&
  orderTimestamp(order) <= todayEnd

const isFinishedTodayOrder = (order, todayStart, todayEnd) =>
  !isGiftCardOrder(order) &&
  isBaseOrder(order) &&
  FINISHED_STATUSES.includes(Number(order?.status)) &&
  orderTimestamp(order) >= todayStart &&
  orderTimestamp(order) <= todayEnd

// redesign bugs-d row 62: one rule per socket event, applied live and again over a fetch that was in flight
const applyDriverChanges = (items, changes) => items.map(driver => {
  const changeData = changes.find(change => change.driver_id === driver.id)
  if (!changeData) return driver
  const updated = { ...driver }
  for (const change of changeData.changes) updated[change.attribute] = change.new
  return updated
})

const applyOrderEvent = (zone) => (prev, payload) => {
  const incoming = payload?.order || payload
  if (!incoming || incoming.id == null) return prev
  const { start, end, yesterdayStart } = todayBounds(zone)
  const existing = prev.get(incoming.id)
  const order = existing ? { ...existing, ...incoming } : incoming
  const keep = isActiveOrder(order, yesterdayStart, end) || isFinishedTodayOrder(order, start, end)
  if (!keep) {
    if (!existing) return prev
    const next = new Map(prev)
    next.delete(incoming.id)
    return next
  }
  const next = new Map(prev)
  next.set(incoming.id, order)
  return next
}

export const DriverStoreStatus = (props) => {
  const { UIComponent } = props

  const [ordering] = useApi()
  const [{ token, loading: sessionLoading, user }] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)
  const userTimeZone = user?.timezone
  const timeZone = useMemo(() => resolveTimeZone(userTimeZone), [userTimeZone])
  const zone = timeZone.zone

  // redesign driver-store-status (M-DSS1): each read keeps an error flag, so a failure is an error the UI can
  // show and retry instead of an empty page with zeros (main swallowed it).
  const [drivers, setDrivers] = useState({ items: [], loading: true, error: false })
  const [groups, setGroups] = useState({ items: [], loading: true, error: false })
  const [businesses, setBusinesses] = useState({ items: [], loading: true, error: false }) // (row 29)
  const [orderCounts, setOrderCounts] = useState({ total: 0, assigned: 0, finished: 0 })
  const [orders, setOrders] = useState(new Map())
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState(false)

  // redesign bugs-d row 62: only the latest read of each source applies; `inFlight` keeps the socket events of that read
  const latest = useRef({ drivers: 0, groups: 0, businesses: 0, orders: 0 })
  const inFlight = useRef({ drivers: null, orders: null })

  const fetchDrivers = useCallback(async () => {
    const run = ++latest.current.drivers
    inFlight.current.drivers = []
    try {
      setDrivers(prev => ({ ...prev, loading: true }))
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .users()
        .asDashboard()
        .select(DRIVER_PROPS)
        .where({ conditions: [{ attribute: 'level', value: [4] }], conector: 'AND' })
        .get()
      if (error) throw new Error('drivers')
      if (run !== latest.current.drivers) return
      const events = inFlight.current.drivers
      inFlight.current.drivers = null
      setDrivers({ items: events.reduce(applyDriverChanges, result || []), loading: false, error: false })
    } catch (err) {
      if (run !== latest.current.drivers) return
      inFlight.current.drivers = null
      setDrivers(prev => ({ ...prev, loading: false, error: true }))
    }
  }, [ordering, token])

  const fetchGroups = useCallback(async () => {
    const run = ++latest.current.groups
    try {
      setGroups(prev => ({ ...prev, loading: true }))
      const response = await fetch(`${ordering.root}/drivergroups?params=${GROUP_PARAMS}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const { error, result } = await response.json()
      // An error answer carries its message in `result`: never read it as groups.
      if (error || !response.ok || !Array.isArray(result)) throw new Error('groups')
      if (run !== latest.current.groups) return
      setGroups({ items: result, loading: false, error: false })
    } catch (err) {
      if (run !== latest.current.groups) return
      setGroups(prev => ({ ...prev, loading: false, error: true }))
    }
  }, [ordering, token])

  // (row 29, driver-store-status P-4): same pattern as the groups (latest run only, loading, an error flag that also reads
  // `content.error`). A failed read keeps what was loaded: the page then works from the groups alone and says so.
  // (review L4): only the admin (level 0) reads the stores. A drivers manager (level 5) may be forbidden `business?mode=dashboard`,
  // which would leave a permanent partial-error notice, and sees only his groups' stores anyway: for any other level no request is made and
  // there are no stores and no error, so the page is as before row 29.
  const userLevel = user?.level
  const fetchBusinesses = useCallback(async () => {
    const run = ++latest.current.businesses
    if (userLevel !== 0) {
      setBusinesses({ items: [], loading: false, error: false })
      return
    }
    try {
      setBusinesses(prev => ({ ...prev, loading: true }))
      const { content } = await ordering
        .setAccessToken(token)
        .businesses()
        .asDashboard()
        .select(BUSINESS_PROPS)
        .where(ACTIVE_BUSINESSES)
        .get()
      if (content?.error || !Array.isArray(content?.result)) throw new Error('businesses')
      if (run !== latest.current.businesses) return
      setBusinesses({ items: content.result, loading: false, error: false })
    } catch (err) {
      if (run !== latest.current.businesses) return
      setBusinesses(prev => ({ ...prev, loading: false, error: true }))
    }
  }, [ordering, token, userLevel])

  const countOrders = useCallback(async (conditions) => {
    const query = ordering
      .setAccessToken(token)
      .orders()
      .asDashboard()
      .select(['id'])
      .parameters({ page: 1, page_size: 1 })
    const scoped = conditions ? query.where({ conditions, conector: 'AND' }) : query
    const { content } = await scoped.get()
    if (content?.error) throw new Error('orders')
    return content?.pagination?.total || 0
  }, [ordering, token])

  const fetchOrderRows = useCallback(async (conditions) => {
    const { content: { error, result } } = await ordering
      .setAccessToken(token)
      .orders()
      .asDashboard()
      .select(ORDER_SELECT)
      .where({ conditions, conector: 'AND' })
      .get()
    if (error) throw new Error('orders')
    return result || []
  }, [ordering, token])

  const fetchOrderMetrics = useCallback(async () => {
    const run = ++latest.current.orders
    inFlight.current.orders = []
    try {
      setOrdersLoading(true)
      const { from, to } = todayRange(zone)
      const active = activeRange(zone)
      const [total, assigned, finished, activeRows, finishedRows] = await Promise.all([
        countOrders([BASE_ORDER_OR]),
        countOrders([BASE_ORDER_OR, DRIVER_ASSIGNED]),
        countOrders([BASE_ORDER_OR, { attribute: 'status', value: FINISHED_STATUSES }]),
        fetchOrderRows([
          BASE_ORDER_OR,
          { attribute: 'status', value: ACTIVE_STATUSES },
          DRIVER_UNASSIGNED,
          { attribute: 'delivery_type', value: DELIVERY_TYPES },
          { attribute: 'delivery_datetime', value: { condition: '>=', value: active.from } },
          { attribute: 'delivery_datetime', value: { condition: '<=', value: active.to } }
        ]),
        fetchOrderRows([
          BASE_ORDER_OR,
          { attribute: 'status', value: FINISHED_STATUSES },
          { attribute: 'delivery_datetime', value: { condition: '>=', value: from } },
          { attribute: 'delivery_datetime', value: { condition: '<=', value: to } }
        ])
      ])
      if (run !== latest.current.orders) return
      setOrderCounts({ total, assigned, finished })
      const merged = new Map()
      for (const order of activeRows || []) merged.set(order.id, order)
      for (const order of finishedRows || []) merged.set(order.id, order)
      const events = inFlight.current.orders
      inFlight.current.orders = null
      setOrders(events.reduce(applyOrderEvent(zone), merged))
      setOrdersError(false)
    } catch (err) {
      if (run !== latest.current.orders) return
      inFlight.current.orders = null
      // keep previous values on error, and say so (M-DSS1)
      setOrdersError(true)
    } finally {
      if (run === latest.current.orders) setOrdersLoading(false)
    }
  }, [countOrders, fetchOrderRows, zone])

  useEffect(() => {
    if (sessionLoading || !token) return
    fetchDrivers()
    fetchGroups()
    fetchBusinesses()
    fetchOrderMetrics()
  }, [sessionLoading, token, fetchDrivers, fetchGroups, fetchBusinesses, fetchOrderMetrics])

  const handleReload = useCallback(() => {
    fetchDrivers()
    fetchGroups()
    fetchBusinesses()
    fetchOrderMetrics()
  }, [fetchDrivers, fetchGroups, fetchBusinesses, fetchOrderMetrics])

  useEffect(() => {
    if (sessionLoading) return
    const handleBatchDriverChanges = (changes) => {
      inFlight.current.drivers?.push(changes)
      setDrivers(prev => ({ ...prev, items: applyDriverChanges(prev.items, changes) }))
    }

    const applyOrder = (payload) => {
      inFlight.current.orders?.push(payload)
      setOrders(prev => applyOrderEvent(zone)(prev, payload))
    }

    socket.on('batch_driver_changes', handleBatchDriverChanges)
    socket.on('update_order', applyOrder)
    socket.on('orders_register', applyOrder)

    return () => {
      socket.off('batch_driver_changes', handleBatchDriverChanges)
      socket.off('update_order', applyOrder)
      socket.off('orders_register', applyOrder)
    }
  }, [socket, sessionLoading, user?.id, zone])

  useEffect(() => {
    if (sessionLoading || !ioSocket) return
    const room = { room: 'drivers', user_id: user?.id, role: 'manager' }
    const handleJoinRoom = () => socket.join(room)
    if (ioSocket.connected) handleJoinRoom()
    ioSocket.on('connect', handleJoinRoom)

    return () => {
      socket.leave && socket.leave(room)
      ioSocket.off('connect', handleJoinRoom)
    }
  }, [ioSocket, sessionLoading, user?.id])

  const { activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness } = useMemo(() => {
    const { start, end, yesterdayStart } = todayBounds(zone)
    const list = [...orders.values()]
    return {
      activeByBusiness: countByBusiness(list.filter(order => isActiveOrder(order, yesterdayStart, end))),
      activeInProgressByBusiness: countByBusiness(list.filter(order => isActiveOrder(order, yesterdayStart, end) && IN_PROGRESS_STATUSES.includes(Number(order.status)))), // (review M4)
      finishedTodayByBusiness: countByBusiness(list.filter(order => isFinishedTodayOrder(order, start, end)))
    }
  }, [orders, zone])

  // (main #487): for the admin, active stores and no driver group covering any of them: the page says a driver group is
  // needed (and links to Delivery Groups). It reads the active stores this page already loads, so no request of its own.
  const storesWithoutGroups = userLevel === 0 &&
    !groups.loading && !groups.error && !businesses.loading && !businesses.error &&
    businesses.items.length > 0 && !groups.items.some(groupHasActiveStore)

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          drivers={drivers.items}
          driversLoading={drivers.loading}
          groups={groups.items}
          groupsLoading={groups.loading}
          structureError={drivers.error || groups.error}
          driversError={drivers.error} // redesign driver-store-status (review r1, Q-01/Q-02): each figure follows its own source
          groupsError={groups.error}
          businesses={businesses.items} // (row 29)
          businessesLoading={businesses.loading}
          businessesError={businesses.error}
          ordersError={ordersError}
          storesWithoutGroups={storesWithoutGroups}
          orderCounts={orderCounts}
          activeByBusiness={activeByBusiness}
          activeInProgressByBusiness={activeInProgressByBusiness}
          finishedTodayByBusiness={finishedTodayByBusiness}
          ordersLoading={ordersLoading}
          onReload={handleReload}
          timeZone={timeZone} // { zone, fallback } the page writes next to its figures
        />
      )}
    </>
  )
}

DriverStoreStatus.propTypes = {
  UIComponent: PropTypes.elementType
}
