import React, { useState } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import {
  buildRoutePoints,
  buildStatusStops,
  getDeliveryDistance,
  toRoutePoint
} from '../../utils/driverOrderRoute'

const ORDER_PARAMS = 'id,status,driver_id,business_id,driver,business,customer,driver_route'

const initialRouteState = {
  loading: false,
  error: null,
  order: null,
  routePoints: [],
  stops: [],
  businessLocation: null,
  customerLocation: null,
  deliveryDistance: null
}

export const DriverOrderRoute = (props) => {
  const { UIComponent } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()

  const [routeState, setRouteState] = useState(initialRouteState)

  const getJson = async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    return response.json()
  }

  const handleSearchOrder = async (orderId) => {
    const id = String(orderId ?? '').trim()
    if (!/^\d+$/.test(id)) {
      setRouteState({ ...initialRouteState, error: t('INVALID_ORDER_NUMBER', 'Enter a valid order number') })
      return
    }
    try {
      setRouteState({ ...initialRouteState, loading: true })
      const [orderResponse, messagesResponse] = await Promise.all([
        getJson(`${ordering.root}/orders/${id}?mode=dashboard&params=${ORDER_PARAMS}`),
        getJson(`${ordering.root}/orders/${id}/messages?mode=dashboard`)
      ])
      if (orderResponse.error) {
        setRouteState({ ...initialRouteState, error: t('ORDER_NOT_FOUND', 'Order not found') })
        return
      }
      const order = orderResponse.result
      const messages = messagesResponse.error ? [] : messagesResponse.result
      const routePoints = buildRoutePoints(order?.driver_route)
      const stops = buildStatusStops(routePoints, messages)
      const customerLocation = toRoutePoint(order?.customer?.location)
      setRouteState({
        ...initialRouteState,
        order,
        routePoints,
        stops,
        businessLocation: toRoutePoint(order?.business?.location),
        customerLocation,
        deliveryDistance: getDeliveryDistance(stops, customerLocation)
      })
    } catch (err) {
      setRouteState({ ...initialRouteState, error: err.message })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          routeState={routeState}
          handleSearchOrder={handleSearchOrder}
        />
      )}
    </>
  )
}
