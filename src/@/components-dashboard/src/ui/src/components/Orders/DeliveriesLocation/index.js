import React, { useEffect, useRef, useState } from 'react'
import { useConfig, useLanguage, useApi, useSession } from '../../../../../index'
import GoogleMapReact, { fitBounds } from 'google-map-react'
import { InterActOrderMarker } from '../InterActOrderMarker'
import { AssignCommentDialog, MapFrame } from '../../Shared/Product'
import { boundsFor, collectPoints, defaultCenter as getDefaultCenter, parseLocation } from '../../../../../utils/mapBounds'
import { DriversDock } from './DriversDock'
import { useAssignDriver } from './useAssignDriver'

import { WrapperMap } from './styles'

// redesign W1-2 (T1-4): the classes the map needs; a blocked or half-loaded Google script leaves `window.google` without them (M-01).
const mapsReady = (maps) => typeof maps?.LatLngBounds === 'function' && typeof maps?.LatLng === 'function'

export const DeliveriesLocation = (props) => {
  const {
    driversList,
    interActionMapOrder,
    // redesign deliveries F2-B2 (decision 3): the board decides who may assign (canAssign), asks for the candidates to take the focus
    // (focusCandidatesToken changes) and hears about a successful assignment (onAssigned).
    canAssign,
    focusCandidatesToken,
    onAssigned
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [session] = useSession()
  const [configState] = useConfig()

  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value

  // redesign W1-2 (T1-4): one tolerant centre and one location parser (utils/mapBounds.js) instead of the inline copies.
  const defaultCenter = getDefaultCenter(configState?.configs)
  const pointOf = (location) => parseLocation(location, defaultCenter)

  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [mapZoom, setMapZoom] = useState(10)
  const [activeDrivers, setActiveDrivers] = useState([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [mapFitted, setMapFitted] = useState(false)

  // redesign deliveries F2-B2 (DV-13): which order the candidates belong to and how the request went, so the dock can say «loading»,
  // «could not load» or «nobody» apart. `requestedOrderId` drops the answer of a request whose order is no longer the chosen one.
  const [candidatesState, setCandidatesState] = useState({ orderId: null, status: 'idle' })
  const requestedOrderId = useRef(null)
  const assigner = useAssignDriver({ onAssigned })

  const [interActionOrderDriverLocation, setInterActionOrderDriverLocation] = useState(null)
  const defaultZoom = 10
  const mapRef = useRef(null)

  const mapFit = () => {
    const drivers = driversList?.drivers || []
    let points
    if (interActionMapOrder === null) {
      if (drivers.length === 1) {
        setMapCenter(pointOf(drivers[0]?.location))
        setMapZoom(defaultZoom)
        return
      }
      points = collectPoints(drivers.map(driver => driver?.location), defaultCenter)
    } else {
      points = [
        pointOf(interActionMapOrder?.business?.location),
        pointOf(interActionMapOrder?.customer?.location)
      ]
      if (interActionMapOrder?.driver !== null) {
        points.push(pointOf(interActionOrderDriverLocation))
      } else {
        points.push(...collectPoints(activeDrivers.map(driver => driver?.location), defaultCenter))
      }
    }

    // redesign W1-2 (T1-4): the size comes from the frame; with no size (hidden tab) or no usable bounds the map keeps its view.
    const fitted = boundsFor(points, {
      width: mapRef.current?.clientWidth,
      height: mapRef.current?.clientHeight,
      defaultZoom,
      fitBounds
    })
    if (!fitted) return
    setMapZoom(fitted.zoom)
    setMapCenter(fitted.center)
    setMapFitted(true)
  }

  // Fit bounds on mount, and when the markers change
  // redesign W1-2 (T1-4): only once Google really loaded (mapLoaded is true only with `maps` in hand).
  useEffect(() => {
    if (driversList.loading || driversList.drivers.length === 0 || !mapLoaded) return
    if (interActionMapOrder !== null) {
      for (const driver of driversList.drivers) {
        if (driver.id === interActionMapOrder?.driver?.id) {
          setInterActionOrderDriverLocation(driver.location)
        }
      }
    }
    if (!mapFitted) {
      mapFit()
    }
  }, [interActionMapOrder, mapLoaded, driversList, mapFitted])

  // redesign W1-2 (T1-4): Google answered without its classes (blocked, or a failed load): the frame says «Map unavailable», nothing else changes.
  const handleGoogleApiLoaded = ({ maps } = {}) => {
    if (!mapsReady(maps)) {
      setMapLoaded(false)
      setUnavailable(true)
      return
    }
    setMapLoaded(true)
  }

  // redesign deliveries F2-B2 (DV-13): `controls` answers a list or an error. Only a list reaches `activeDrivers`; an error leaves it empty
  // and the dock says it could not load, with a retry. The request itself is the one the panel always made.
  const getControls = async (order) => {
    const { content: { error: errorResponse, result: response } } = await ordering.setAccessToken(session?.token).controls(order?.id).get()
    const error = await errorResponse
    const result = await response
    if (error) return null
    if (Array.isArray(result?.drivers) && result?.drivers.length > 0) {
      return result.drivers.filter((driver) => driver.available && !driver.busy)
    }
    return []
  }

  const loadCandidates = async (order) => {
    const orderId = order?.id
    requestedOrderId.current = orderId
    setActiveDrivers([])
    setCandidatesState({ orderId, status: 'loading' })
    let list = null
    try {
      list = await getControls(order)
    } catch (err) {
      list = null
    }
    if (requestedOrderId.current !== orderId) return
    if (Array.isArray(list)) {
      setActiveDrivers(list)
      setCandidatesState({ orderId, status: 'ready' })
    } else {
      setActiveDrivers([])
      setCandidatesState({ orderId, status: 'error' })
    }
  }

  useEffect(() => {
    requestedOrderId.current = interActionMapOrder?.id ?? null
    assigner.dismissError()
    if (!interActionMapOrder || interActionMapOrder?.driver) {
      setCandidatesState({ orderId: null, status: 'idle' })
      return
    }
    loadCandidates(interActionMapOrder)
  }, [interActionMapOrder?.id])

  useEffect(() => {
    if (activeDrivers.length === 0 && interActionMapOrder) return
    const _driverAvailableList = driversList.drivers.filter((driver) => driver.enabled && driver.available && !driver.busy)
    if (!interActionMapOrder) {
      setActiveDrivers(_driverAvailableList)
      return
    }
    const _onlineDrivers = activeDrivers.map((controlDriver) => {
      const matchingDriver = _driverAvailableList.find((driver) => driver.id === controlDriver.id)
      if (matchingDriver?.location) {
        return { ...controlDriver, location: matchingDriver?.location }
      } else {
        return controlDriver
      }
    })
    setActiveDrivers(_onlineDrivers)
  }, [driversList])

  useEffect(() => {
    setMapFitted(false)
  }, [interActionMapOrder])

  const handleMapChange = (data) => {
    if (!data?.zoom) return
    setMapZoom(data?.zoom)
  }

  return (
    <WrapperMap className='drivers-location'>
      {/* redesign W1-2 (T1-3): the map is the frame's child; the «Drivers online» panel below is not, so it still helps when the map fails. */}
      <MapFrame
        ref={mapRef}
        size='fill'
        label={t('DELIVERY_MAP', 'Delivery map')}
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
          {interActionMapOrder !== null && (
            <InterActOrderMarker
              business={interActionMapOrder?.business}
              lat={pointOf(interActionMapOrder?.business?.location).lat} lng={pointOf(interActionMapOrder?.business?.location).lng}
              image={interActionMapOrder?.business?.logo}
            />
          )}

          {interActionMapOrder !== null && (
            <InterActOrderMarker
              customer={interActionMapOrder?.customer}
              lat={pointOf(interActionMapOrder?.customer?.location).lat} lng={pointOf(interActionMapOrder?.customer?.location).lng}
              image={interActionMapOrder?.customer?.photo}
            />
          )}

          {interActionMapOrder !== null && interActionMapOrder?.driver !== null && (
            <InterActOrderMarker
              driver={interActionMapOrder?.driver}
              timeStatus={interActionMapOrder?.time_status}
              lat={pointOf(interActionOrderDriverLocation).lat} lng={pointOf(interActionOrderDriverLocation).lng}
              image={interActionMapOrder?.driver?.photo}
            />
          )}

          {interActionMapOrder === null && activeDrivers.length > 0 && (
            activeDrivers.map((driver) => (
              <InterActOrderMarker
                key={driver.id}
                driver={driver}
                timeStatus={interActionMapOrder?.time_status}
                lat={pointOf(driver?.location).lat} lng={pointOf(driver?.location).lng}
                image={driver?.photo}
              />
            ))
          )}
        </GoogleMapReact>
      </MapFrame>

      {/* redesign deliveries F2-B2 (decisions 1 and 3; DV-01): the strip is the column's second child, outside the frame. */}
      <DriversDock
        order={interActionMapOrder}
        drivers={driversList?.drivers}
        driversLoading={driversList?.loading}
        candidates={activeDrivers}
        candidatesStatus={interActionMapOrder && candidatesState.orderId === interActionMapOrder.id ? candidatesState.status : 'loading'}
        onRetryCandidates={() => loadCandidates(interActionMapOrder)}
        canAssign={canAssign}
        assigner={assigner}
        focusToken={focusCandidatesToken}
      />
      <AssignCommentDialog
        open={assigner.comment.open}
        onSubmit={assigner.comment.onSubmit}
        onCancel={assigner.comment.onCancel}
      />
    </WrapperMap>
  )
}
