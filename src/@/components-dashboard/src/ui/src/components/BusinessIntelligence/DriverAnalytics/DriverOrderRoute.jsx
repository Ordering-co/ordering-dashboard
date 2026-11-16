import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  useConfig,
  useLanguage,
  useUtils,
  DriverOrderRoute as DriverOrderRouteController
} from '../../../../../index'
import { downloadCsv } from '../../../../../utils/businessReports'
import { buildStopsCsv } from '../../../../../utils/driverOrderRoute'
import { Button, DataTable, EmptyState, MapFrame, Skeleton, TextField } from '../../Shared/Product'
import { Download, MapPin } from '../../Shared/Icon'
import { CardAction, ReportCard } from '../AnalyticsKit'
// the map, its markers, its clusters and its bounds are the ones of `main`; nothing of it is copied
import { DriverRouteMap } from '../AnalyticsDriverOrderRoute/DriverRouteMap'
import './driver-order-route.css'

// (port of «Driver route by order», main 5063dbb4): /intelligence/drivers, last section. The lookup is by order
// number: where the driver was at each status change of ONE order. It does not read the period or the filters of the page, so it is a card
// of its own with its own controller (`DriverOrderRoute` of ~components). Texts and keys are those of `main`.

const DASH = '—'

// The map paints on a canvas: it cannot read `var()`, so the markers get the resolved value of the token (as the charts do).
// The legend swatches in the CSS use the same tokens.
const MARKER_TOKENS = { stop: '--od-action', business: '--od-success-functional', customer: '--od-danger-signal' }

const readMarkerColors = (node) => {
  const style = window.getComputedStyle(node)
  return Object.fromEntries(Object.entries(MARKER_TOKENS).map(([kind, token]) => [kind, style.getPropertyValue(token).trim() || undefined]))
}

const getStopId = (stop) => stop.status

const DriverOrderRouteUI = (props) => {
  const { routeState, handleSearchOrder, headingLevel } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const [{ getOrderState, parseDate, parseDistance }] = useUtils()

  const rootRef = useRef(null)
  const [orderId, setOrderId] = useState('')
  const [colors, setColors] = useState({})

  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value
  const { loading, error, order, routePoints, stops, businessLocation, customerLocation, deliveryDistance } = routeState
  const title = t('DRIVER_ROUTE_BY_ORDER', 'Driver route by order')
  const driverName = [order?.driver?.name, order?.driver?.lastname].filter(Boolean).join(' ')
  const canDownload = !loading && Boolean(order) && stops.length > 0

  // the markers are painted when an order arrives: read the tokens of the theme that is on screen at that moment
  useLayoutEffect(() => {
    if (rootRef.current) setColors(readMarkerColors(rootRef.current))
  }, [order])

  const onSubmit = (event) => {
    event.preventDefault()
    handleSearchOrder(orderId)
  }

  const getStopTitle = (stop, index) => `${index + 1}. ${getOrderState(stop.status)}`

  const formatDistance = (meters) => {
    const rounded = Number(meters.toFixed(2))
    return rounded < 1000
      ? `${rounded} ${t('METERS_SHORT', 'm')}`
      : parseDistance(meters)
  }

  const handleDownload = () => {
    if (!canDownload) return
    const csv = buildStopsCsv({
      headers: [
        t('ORDER', 'Order'),
        '#',
        t('STATUS', 'Status'),
        t('DATE', 'Date'),
        t('LATITUDE', 'Latitude'),
        t('LONGITUDE', 'Longitude'),
        t('DRIVER', 'Driver'),
        t('DRIVER_ID', 'Driver ID')
      ],
      orderId: order.id,
      driverName,
      driverId: order.driver?.id ?? order.driver_id,
      stops,
      getStatusLabel: getOrderState,
      formatDate: parseDate
    })
    downloadCsv(`driver_route_order_${order.id}.csv`, csv)
  }

  const columns = useMemo(() => [
    { id: 'number', header: '#', cell: (stop) => <span className='odc-bi-route-mark' data-kind='stop'>{stops.indexOf(stop) + 1}</span> },
    { id: 'status', header: t('STATUS', 'Status'), cell: (stop) => getOrderState(stop.status), wrap: true },
    { id: 'date', header: t('DATE', 'Date'), cell: (stop) => (stop.at ? parseDate(stop.at) : DASH) },
    { id: 'location', header: t('LOCATION', 'Location'), cell: (stop) => `${stop.lat}, ${stop.lng}` }
  ], [stops, t, getOrderState, parseDate])

  let result = null
  if (loading) {
    result = (
      <div aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <Skeleton size='100%' block='var(--od-x-map-height)' />
      </div>
    )
  } else if (order) {
    result = (
      <>
        <dl className='odc-bi-route-summary'>
          <div>
            <dt>{t('ORDER', 'Order')}</dt>
            <dd>#{order.id}</dd>
          </div>
          <div>
            <dt>{t('DRIVER', 'Driver')}</dt>
            <dd>{driverName || t('NOT_ASSIGNED', 'Not assigned')}</dd>
          </div>
          <div>
            <dt>{t('STATUS', 'Status')}</dt>
            <dd>{getOrderState(order.status)}</dd>
          </div>
        </dl>

        {routePoints.length === 0
          ? <EmptyState icon={MapPin} title={t('DRIVER_ROUTE_NO_LOCATIONS', 'No driver locations were recorded for this order.')} />
          : (
            <>
              {/* with no key the frame says so in the slot of the map; with a key that fails to load it says «Map unavailable» */}
              <MapFrame
                label={t('LOCATION', 'Location')}
                apiKey={googleMapsApiKey}
                unavailableTitle={googleMapsApiKey
                  ? t('MAP_UNAVAILABLE', 'Map unavailable')
                  : t('GOOGLE_MAPS_API_KEY_REQUIRED', 'A Google Maps API key is required to show the map.')}
              >
                <DriverRouteMap
                  apiKey={googleMapsApiKey}
                  stops={stops}
                  businessLocation={businessLocation}
                  customerLocation={customerLocation}
                  colors={colors}
                  getStopTitle={getStopTitle}
                  businessTitle={order?.business?.name || t('BUSINESS', 'Business')}
                  customerTitle={order?.customer?.address || t('CUSTOMER', 'Customer')}
                />
              </MapFrame>

              <ul className='odc-bi-route-legend'>
                <li><span className='odc-bi-route-mark' data-kind='business' aria-hidden='true'>B</span>{t('BUSINESS', 'Business')}</li>
                <li><span className='odc-bi-route-mark' data-kind='customer' aria-hidden='true'>C</span>{t('CUSTOMER', 'Customer')}</li>
                <li><span className='odc-bi-route-mark' data-kind='stop' aria-hidden='true'>1</span>{t('STATUS_CHANGES', 'Status changes')}</li>
              </ul>

              {deliveryDistance !== null && (
                <p className='odc-bi-route-distance'>
                  {t('DELIVERY_DISTANCE_FROM_CUSTOMER', 'Delivery was marked _distance_ from the customer\'s address.').replace('_distance_', formatDistance(deliveryDistance))}
                </p>
              )}

              <DataTable
                label={t('STATUS_CHANGES', 'Status changes')}
                scrollLabel={t('STATUS_CHANGES', 'Status changes')}
                columns={columns}
                rows={stops}
                getRowId={getStopId}
              />
            </>
            )}
      </>
    )
  }

  return (
    <ReportCard
      title={title}
      headingLevel={headingLevel}
      actions={<CardAction icon={Download} label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`} onClick={handleDownload} disabled={!canDownload} />}
    >
      <div className='odc-bi-route' ref={rootRef}>
        <p className='odc-bi-route-hint'>{t('DRIVER_ROUTE_BY_ORDER_DESCRIPTION', 'Where the driver was at each status change of an order.')}</p>
        <form className='odc-bi-route-search' onSubmit={onSubmit}>
          <TextField
            label={t('ORDER_NUMBER', 'Order number')}
            value={orderId}
            onChange={setOrderId}
            inputMode='numeric'
            autoComplete='off'
            error={!loading && error ? error : undefined}
          />
          <Button type='submit' variant='primary' disabled={loading || !orderId.trim()}>{t('SEARCH', 'Search')}</Button>
        </form>
        {result}
      </div>
    </ReportCard>
  )
}

/** The card «Driver route by order». It reads neither the period nor the filters of the page. */
export const DriverOrderRoute = (props) => (
  <DriverOrderRouteController {...props} UIComponent={DriverOrderRouteUI} />
)
