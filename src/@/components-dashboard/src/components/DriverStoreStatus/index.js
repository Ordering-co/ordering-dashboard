import React, { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'

const DRIVER_PROPS = ['id', 'enabled', 'available', 'busy', 'driver_groups.id', 'driver_groups.name']
const GROUP_PARAMS = 'id,name,business'
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
const FINISHED_STATUSES = [1, 11, 15]

const countByBusiness = (orders) => {
  const map = new Map()
  for (const order of orders || []) {
    if (order.business_id == null) continue
    map.set(order.business_id, (map.get(order.business_id) || 0) + 1)
  }
  return map
}

const todayRange = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { from: `${day} 00:00:00`, to: `${day} 23:59:59` }
}

const todayBounds = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return { start, end: start + (24 * 60 * 60 * 1000) - 1 }
}

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

const isActiveOrder = (order, todayStart) =>
  !isGiftCardOrder(order) &&
  isBaseOrder(order) &&
  ACTIVE_STATUSES.includes(Number(order?.status)) &&
  order?.driver_id == null &&
  orderTimestamp(order) >= todayStart

const isFinishedTodayOrder = (order, todayStart, todayEnd) =>
  !isGiftCardOrder(order) &&
  isBaseOrder(order) &&
  FINISHED_STATUSES.includes(Number(order?.status)) &&
  orderTimestamp(order) >= todayStart &&
  orderTimestamp(order) <= todayEnd

export const DriverStoreStatus = (props) => {
  const { UIComponent } = props

  const [ordering] = useApi()
  const [{ token, loading: sessionLoading, user }] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)

  const [drivers, setDrivers] = useState({ items: [], loading: true })
  const [groups, setGroups] = useState({ items: [], loading: true })
  const [orderCounts, setOrderCounts] = useState({ total: 0, assigned: 0, finished: 0 })
  const [orders, setOrders] = useState(new Map())
  const [ordersLoading, setOrdersLoading] = useState(true)

  const fetchDrivers = useCallback(async () => {
    try {
      setDrivers(prev => ({ ...prev, loading: true }))
      const { content: { result } } = await ordering
        .setAccessToken(token)
        .users()
        .asDashboard()
        .select(DRIVER_PROPS)
        .where({ conditions: [{ attribute: 'level', value: [4] }], conector: 'AND' })
        .get()
      setDrivers({ items: result || [], loading: false })
    } catch (err) {
      setDrivers(prev => ({ ...prev, loading: false }))
    }
  }, [ordering, token])

  const fetchGroups = useCallback(async () => {
    try {
      setGroups(prev => ({ ...prev, loading: true }))
      const response = await fetch(`${ordering.root}/drivergroups?params=${GROUP_PARAMS}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const { result } = await response.json()
      setGroups({ items: result || [], loading: false })
    } catch (err) {
      setGroups(prev => ({ ...prev, loading: false }))
    }
  }, [ordering, token])

  const countOrders = useCallback(async (conditions) => {
    const query = ordering
      .setAccessToken(token)
      .orders()
      .asDashboard()
      .select(['id'])
      .parameters({ page: 1, page_size: 1 })
    const scoped = conditions ? query.where({ conditions, conector: 'AND' }) : query
    const { content } = await scoped.get()
    return content?.pagination?.total || 0
  }, [ordering, token])

  const fetchOrderRows = useCallback(async (conditions) => {
    const { content: { result } } = await ordering
      .setAccessToken(token)
      .orders()
      .asDashboard()
      .select(ORDER_SELECT)
      .where({ conditions, conector: 'AND' })
      .get()
    return result || []
  }, [ordering, token])

  const fetchOrderMetrics = useCallback(async () => {
    try {
      setOrdersLoading(true)
      const { from, to } = todayRange()
      const [total, assigned, finished, activeRows, finishedRows] = await Promise.all([
        countOrders([BASE_ORDER_OR]),
        countOrders([BASE_ORDER_OR, DRIVER_ASSIGNED]),
        countOrders([BASE_ORDER_OR, { attribute: 'status', value: FINISHED_STATUSES }]),
        fetchOrderRows([
          BASE_ORDER_OR,
          { attribute: 'status', value: ACTIVE_STATUSES },
          DRIVER_UNASSIGNED,
          { attribute: 'delivery_datetime', value: { condition: '>=', value: from } }
        ]),
        fetchOrderRows([
          BASE_ORDER_OR,
          { attribute: 'status', value: FINISHED_STATUSES },
          { attribute: 'delivery_datetime', value: { condition: '>=', value: from } },
          { attribute: 'delivery_datetime', value: { condition: '<=', value: to } }
        ])
      ])
      setOrderCounts({ total, assigned, finished })
      const merged = new Map()
      for (const order of activeRows || []) merged.set(order.id, order)
      for (const order of finishedRows || []) merged.set(order.id, order)
      setOrders(merged)
    } catch (err) {
      // keep previous values on error
    } finally {
      setOrdersLoading(false)
    }
  }, [countOrders, fetchOrderRows])

  useEffect(() => {
    if (sessionLoading || !token) return
    fetchDrivers()
    fetchGroups()
    fetchOrderMetrics()
  }, [sessionLoading, token, fetchDrivers, fetchGroups, fetchOrderMetrics])

  const handleReload = useCallback(() => {
    fetchDrivers()
    fetchGroups()
    fetchOrderMetrics()
  }, [fetchDrivers, fetchGroups, fetchOrderMetrics])

  useEffect(() => {
    if (sessionLoading) return
    const handleBatchDriverChanges = (changes) => {
      setDrivers(prev => ({
        ...prev,
        items: prev.items.map(driver => {
          const changeData = changes.find(change => change.driver_id === driver.id)
          if (!changeData) return driver
          const updated = { ...driver }
          for (const change of changeData.changes) updated[change.attribute] = change.new
          return updated
        })
      }))
    }

    const applyOrder = (payload) => {
      const incoming = payload?.order || payload
      if (!incoming || incoming.id == null) return
      const { start, end } = todayBounds()
      setOrders(prev => {
        const existing = prev.get(incoming.id)
        const order = existing ? { ...existing, ...incoming } : incoming
        const keep = isActiveOrder(order, start) || isFinishedTodayOrder(order, start, end)
        if (!keep) {
          if (!existing) return prev
          const next = new Map(prev)
          next.delete(incoming.id)
          return next
        }
        const next = new Map(prev)
        next.set(incoming.id, order)
        return next
      })
    }

    socket.on('batch_driver_changes', handleBatchDriverChanges)
    socket.on('update_order', applyOrder)
    socket.on('orders_register', applyOrder)

    return () => {
      socket.off('batch_driver_changes', handleBatchDriverChanges)
      socket.off('update_order', applyOrder)
      socket.off('orders_register', applyOrder)
    }
  }, [socket, sessionLoading, user?.id])

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

  const { activeByBusiness, finishedTodayByBusiness } = useMemo(() => {
    const { start, end } = todayBounds()
    const list = [...orders.values()]
    return {
      activeByBusiness: countByBusiness(list.filter(order => isActiveOrder(order, start))),
      finishedTodayByBusiness: countByBusiness(list.filter(order => isFinishedTodayOrder(order, start, end)))
    }
  }, [orders])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          drivers={drivers.items}
          driversLoading={drivers.loading}
          groups={groups.items}
          groupsLoading={groups.loading}
          orderCounts={orderCounts}
          activeByBusiness={activeByBusiness}
          finishedTodayByBusiness={finishedTodayByBusiness}
          ordersLoading={ordersLoading}
          onReload={handleReload}
        />
      )}
    </>
  )
}

DriverStoreStatus.propTypes = {
  UIComponent: PropTypes.elementType
}
