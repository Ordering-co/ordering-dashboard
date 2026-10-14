import React, { useState } from 'react'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import BsDownload from '@meronex/icons/bs/BsDownload'
import {
  useConfig,
  useLanguage,
  useUtils,
  DriverOrderRoute as DriverOrderRouteController
} from '../../../../../index'
import { buildStopsCsv } from '../../../../../utils/driverOrderRoute'
import { Button, Input } from '../../../styles'
import { DriverRouteMap } from './DriverRouteMap'
import {
  Container,
  Header,
  ActionBlock,
  SearchForm,
  Message,
  Summary,
  MapWrapper,
  Legend,
  LegendItem,
  Dot,
  PinDot,
  DeliveryDistance,
  TableToolbar,
  StopsTable
} from './styles'

const AnalyticsDriverOrderRouteUI = (props) => {
  const { routeState, handleSearchOrder } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const [{ getOrderState, parseDate, parseDistance }] = useUtils()
  const theme = useTheme()

  const [orderId, setOrderId] = useState('')

  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value
  const { order, routePoints, stops, businessLocation, customerLocation, deliveryDistance } = routeState
  const colors = {
    stop: theme.colors.primary,
    business: theme.colors.green,
    customer: theme.colors.danger
  }
  const driverName = [order?.driver?.name, order?.driver?.lastname].filter(Boolean).join(' ')

  const onSubmit = (e) => {
    e.preventDefault()
    handleSearchOrder(orderId)
  }

  const getStopTitle = (stop, index) => `${index + 1}. ${getOrderState(stop.status)}`

  const formatDistance = (meters) => {
    const rounded = Number(meters.toFixed(2))
    return rounded < 1000
      ? `${rounded} ${t('METERS_SHORT', 'm')}`
      : parseDistance(meters)
  }

  const canDownload = !routeState.loading && !!order && stops.length > 0

  const downloadCSV = () => {
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
    const downloadLink = document.createElement('a')
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    downloadLink.href = url
    downloadLink.download = `driver_route_order_${order.id}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(url)
  }

  return (
    <Container>
      <Header>
        <p>{t('DRIVER_ROUTE_BY_ORDER', 'Driver route by order')}</p>
        <span>{t('DRIVER_ROUTE_BY_ORDER_DESCRIPTION', 'Where the driver was at each status change of an order.')}</span>
      </Header>

      <SearchForm onSubmit={onSubmit}>
        <Input
          type='text'
          inputMode='numeric'
          placeholder={t('ORDER_NUMBER', 'Order number')}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <Button color='primary' borderRadius='8px' type='submit' disabled={routeState.loading || !orderId.trim()}>
          {t('SEARCH', 'Search')}
        </Button>
      </SearchForm>

      {routeState.loading && <Skeleton height={320} />}

      {!routeState.loading && routeState.error && <Message>{routeState.error}</Message>}

      {!routeState.loading && order && (
        <>
          <Summary>
            <strong>{t('ORDER', 'Order')} #{order.id}</strong>
            <span><strong>{t('DRIVER', 'Driver')}:</strong> {driverName || t('NOT_ASSIGNED', 'Not assigned')}</span>
            <span><strong>{t('STATUS', 'Status')}:</strong> {getOrderState(order.status)}</span>
          </Summary>

          {routePoints.length === 0
            ? (
              <Message>{t('DRIVER_ROUTE_NO_LOCATIONS', 'No driver locations were recorded for this order.')}</Message>
              )
            : (
              <>
                <MapWrapper>
                  {googleMapsApiKey
                    ? (
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
                      )
                    : (
                      <Message>{t('GOOGLE_MAPS_API_KEY_REQUIRED', 'A Google Maps API key is required to show the map.')}</Message>
                      )}
                </MapWrapper>

                <Legend>
                  <LegendItem><PinDot color={colors.business}>B</PinDot>{t('BUSINESS', 'Business')}</LegendItem>
                  <LegendItem><PinDot color={colors.customer}>C</PinDot>{t('CUSTOMER', 'Customer')}</LegendItem>
                  <LegendItem><Dot color={colors.stop}>1</Dot>{t('STATUS_CHANGES', 'Status changes')}</LegendItem>
                </Legend>

                {deliveryDistance !== null && (
                  <DeliveryDistance>
                    {t('DELIVERY_DISTANCE_FROM_CUSTOMER', 'Delivery was marked _distance_ from the customer\'s address.').replace('_distance_', formatDistance(deliveryDistance))}
                  </DeliveryDistance>
                )}

                <TableToolbar>
                  <p>{t('STATUS_CHANGES', 'Status changes')}</p>
                  <ActionBlock disabled={!canDownload}>
                    <BsDownload onClick={downloadCSV} />
                  </ActionBlock>
                </TableToolbar>
                <StopsTable>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('STATUS', 'Status')}</th>
                      <th>{t('DATE', 'Date')}</th>
                      <th>{t('LOCATION', 'Location')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stops.map((stop, index) => (
                      <tr key={stop.status}>
                        <td><Dot color={colors.stop}>{index + 1}</Dot></td>
                        <td>{getOrderState(stop.status)}</td>
                        <td>{stop.at ? parseDate(stop.at) : '-'}</td>
                        <td>{stop.lat}, {stop.lng}</td>
                      </tr>
                    ))}
                  </tbody>
                </StopsTable>
              </>
              )}
        </>
      )}
    </Container>
  )
}

export const AnalyticsDriverOrderRoute = (props) => {
  const driverOrderRouteProps = {
    ...props,
    UIComponent: AnalyticsDriverOrderRouteUI
  }
  return <DriverOrderRouteController {...driverOrderRouteProps} />
}
