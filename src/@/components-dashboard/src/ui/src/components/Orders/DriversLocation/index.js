import React, { useEffect, useRef, useState } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import GoogleMapReact, { fitBounds } from 'google-map-react'
import { DriverMapMarkerAndInfo } from '../DriverMapMarkerAndInfo'
import { InterActOrderMarker } from '../InterActOrderMarker'
import { SpinnerLoader } from '../../Shared'
import { MapFrame } from '../../Shared/Product'
import { boundsFor, collectPoints, defaultCenter as getDefaultCenter, parseLocation } from '../../../../../utils/mapBounds'

import {
  WrapperMap
} from './styles'

// redesign W1-2 (T1-4): the classes the map needs; a blocked or half-loaded Google script leaves `window.google` without them (M-01).
const mapsReady = (maps) => typeof maps?.LatLngBounds === 'function' && typeof maps?.LatLng === 'function'

export const DriversLocation = (props) => {
  const {
    driversIsOnline,
    onlineDrivers,
    offlineDrivers,
    selectedDriver,
    selectedOrder,
    assignedOrders
  } = props

  const [configState] = useConfig()
  const [, t] = useLanguage()
  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value

  // redesign W1-2 (T1-4): one tolerant centre and one location parser (utils/mapBounds.js) instead of the inline copies.
  const defaultCenter = getDefaultCenter(configState?.configs)
  const pointOf = (location) => parseLocation(location, defaultCenter)
  const defaultZoom = 10

  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [mapZoom, setMapZoom] = useState(defaultZoom)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [mapFitted, setMapFitted] = useState(false)
  const [hasManualView, setHasManualView] = useState(false)

  const mapRef = useRef(null)
  const isProgrammaticChangeRef = useRef(false)

  const [showDrivers, setShowDrivers] = useState([])

  const releaseProgrammaticChange = () => {
    setTimeout(() => {
      isProgrammaticChangeRef.current = false
    }, 0)
  }

  const mapFit = () => {
    if (!selectedOrder && showDrivers.length === 1 && !assignedOrders?.orders?.length) {
      isProgrammaticChangeRef.current = true
      setMapCenter(pointOf(showDrivers[0]?.location))
      setMapZoom(mapZoom)
      setMapFitted(true)
      releaseProgrammaticChange()
      return
    }

    const points = []
    if (!selectedOrder) {
      points.push(...collectPoints(showDrivers.map(driver => driver?.location), defaultCenter))
    }
    if (selectedOrder) {
      points.push(pointOf(selectedOrder?.business?.location), pointOf(selectedOrder?.customer?.location))
    }
    if (selectedOrder?.driver) {
      points.push(pointOf(selectedOrder.driver.location))
    }
    if (selectedDriver && assignedOrders?.orders?.length && !selectedOrder) {
      assignedOrders.orders.forEach(order => {
        points.push(pointOf(order?.business?.location), pointOf(order?.customer?.location))
      })
    }

    // redesign W1-2 (T1-4): the size comes from the frame; with no size (hidden tab) or no usable bounds the map keeps its view.
    const fitted = boundsFor(points, {
      width: mapRef.current?.clientWidth,
      height: mapRef.current?.clientHeight,
      defaultZoom,
      fitBounds
    })
    if (!fitted) return
    isProgrammaticChangeRef.current = true
    setMapZoom(fitted.zoom)
    setMapCenter(fitted.center)
    setMapFitted(true)
    releaseProgrammaticChange()
  }

  // Fit bounds on mount, and when the markers change
  useEffect(() => {
    // redesign W1-2 (T1-4): only once Google really loaded (mapLoaded is true only with `maps` in hand).
    if (!mapLoaded) return
    if (showDrivers.length === 0) {
      setMapZoom(defaultZoom)
      setMapCenter(defaultCenter)
      setMapFitted(false)
      setHasManualView(false)
      return
    }
    if (hasManualView) return
    if ((selectedOrder && selectedDriver) || (selectedDriver && assignedOrders?.orders?.length) || (!selectedOrder && !selectedDriver)) {
      mapFit()
      return
    }
    if (!mapFitted) {
      mapFit()
    }
  }, [JSON.stringify(showDrivers), mapLoaded, mapFitted, selectedOrder, assignedOrders?.orders, hasManualView])

  useEffect(() => {
    if (selectedDriver) {
      setShowDrivers([selectedDriver])
    } else {
      if (driversIsOnline) {
        setShowDrivers(onlineDrivers)
      } else {
        setShowDrivers(offlineDrivers)
      }
    }
  }, [onlineDrivers, offlineDrivers, driversIsOnline, selectedDriver])

  // redesign W1-2 (T1-4): Google answered without its classes (blocked, or a failed load): the frame says «Map unavailable», nothing else changes.
  const handleGoogleApiLoaded = ({ maps } = {}) => {
    if (!mapsReady(maps)) {
      setMapLoaded(false)
      setUnavailable(true)
      return
    }
    setMapLoaded(true)
  }

  const handleMapChange = (data) => {
    if (isProgrammaticChangeRef.current) return
    setHasManualView(true)
    setMapZoom(data?.zoom)
    if (data?.center?.lat && data?.center?.lng) {
      setMapCenter({ lat: data.center.lat, lng: data.center.lng })
    }
  }

  useEffect(() => {
    setMapFitted(false)
  }, [selectedOrder])

  useEffect(() => {
    setHasManualView(false)
    setMapFitted(false)
  }, [selectedOrder, selectedDriver, driversIsOnline])

  return (
    <>
      {selectedDriver && assignedOrders?.loading && (
        <SpinnerLoader primary />
      )}
      <WrapperMap className='drivers-location'>
        {/* redesign W1-2 (T1-3): the map sits in the frame (one region, the frame's); a failure shows «Map unavailable» in the same slot. */}
        <MapFrame
          ref={mapRef}
          size='fill'
          label={t('DRIVERS_MAP', 'Drivers map')}
          apiKey={googleMapsApiKey}
          unavailable={unavailable}
          unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
          unavailableDescription={t('MAP_UNAVAILABLE_DASHBOARD_TEXT', 'The map could not load. Everything else on this page still works.')}
        >
          <GoogleMapReact
            bootstrapURLKeys={{
              key: window.document.getElementById('__googleMapsScriptId') ? null : googleMapsApiKey,
              libraries: ['places', 'geometry', 'drawing', 'visualization']
            }}
            onGoogleApiLoaded={handleGoogleApiLoaded}
            defaultCenter={defaultCenter}
            center={mapCenter}
            defaultZoom={defaultZoom}
            zoom={mapZoom}
            options={{ fullscreenControl: true }}
            className='map'
            onChange={(data) => handleMapChange(data)}
            yesIWantToUseGoogleMapApiInternals
          >
            {!selectedOrder && (showDrivers.length !== 0) &&
              showDrivers.map((driver) => (
                <DriverMapMarkerAndInfo
                  key={driver.id}
                  driver={driver}
                  timeStatus={selectedOrder?.time_status || (assignedOrders?.orders?.length && assignedOrders?.orders?.some(order => order.time_status === 'delayed') && 'delayed')}
                  lat={pointOf(driver?.location).lat} lng={pointOf(driver?.location).lng}
                />
              ))}
            {selectedOrder && (
              <InterActOrderMarker
                customer={selectedOrder?.customer}
                lat={pointOf(selectedOrder?.customer?.location).lat} lng={pointOf(selectedOrder?.customer?.location).lng}
                image={selectedOrder?.customer?.photo}
              />
            )}
            {selectedOrder && (
              <InterActOrderMarker
                business={selectedOrder?.business}
                lat={pointOf(selectedOrder?.business?.location).lat} lng={pointOf(selectedOrder?.business?.location).lng}
                image={selectedOrder?.business?.logo}
              />
            )}
            {selectedOrder?.driver && (
              <DriverMapMarkerAndInfo
                driver={selectedOrder?.driver}
                timeStatus={selectedOrder?.time_status}
                lat={pointOf(selectedOrder?.driver?.location).lat} lng={pointOf(selectedOrder?.driver?.location).lng}
              />
            )}
            {selectedDriver && assignedOrders?.orders?.length > 0 && !selectedOrder && (
              assignedOrders.orders.map(order => (
                <InterActOrderMarker
                  key={order.id}
                  customer={order?.customer}
                  lat={pointOf(order?.customer?.location).lat} lng={pointOf(order?.customer?.location).lng}
                  image={order?.customer?.photo}
                />
              ))
            )}
            {selectedDriver && assignedOrders?.orders?.length > 0 && !selectedOrder && (
              assignedOrders.orders.map(order => (
                <InterActOrderMarker
                  key={order.id}
                  business={order?.business}
                  lat={pointOf(order?.business?.location).lat} lng={pointOf(order?.business?.location).lng}
                  image={order?.business?.logo}
                />
              ))
            )}
          </GoogleMapReact>
        </MapFrame>
      </WrapperMap>
    </>
  )
}
