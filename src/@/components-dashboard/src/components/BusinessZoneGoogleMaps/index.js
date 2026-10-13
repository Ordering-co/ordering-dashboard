import React, { useEffect, useRef, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { TerraDraw, TerraDrawCircleMode, TerraDrawPolygonMode, TerraDrawSelectMode, TerraDrawRenderMode } from 'terra-draw'
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter'

export const BusinessZoneGoogleMaps = (props) => {
  const {
    apiKey,
    mapControls,
    clearState,
    location,
    type,
    data,
    fillStyle,
    infoContentString,
    handleData,
    setClearState,
    isAddMode,
    greenFillStyle,
    businessZones,
    kmlData,
    disabled,
    distance,
    isDriverGroup,
    managedLifecycle = false
  } = props

  if (!apiKey) {
    console.warn('Prop `apiKey` is required to use Google Maps components.')
  }

  const divRef = useRef()
  const [googleMap, setGoogleMap] = useState(null)
  const [googleMapMarker, setGoogleMapMarker] = useState(null)
  const [circleZone, setCircleZone] = useState(null)
  const [distanceBased, setDistanceBased] = useState(null)
  const [polygonZone, setPolygonZone] = useState(null)
  const [infoWindow, setInfoWindow] = useState(null)
  const terraDrawRef = useRef(null)
  const ownedResources = useRef({})
  ownedResources.current = { googleMap, googleMapMarker, circleZone, distanceBased, polygonZone, infoWindow }
  useEffect(() => {
    if (!managedLifecycle) return
    return () => {
      terraDrawRef.current?.stop()
      terraDrawRef.current = null
      const resources = ownedResources.current
      resources.infoWindow?.close()
      for (const shape of [resources.googleMapMarker, resources.circleZone, resources.distanceBased, resources.polygonZone]) shape?.setMap(null)
      if (resources.googleMap) window.google?.maps?.event?.clearInstanceListeners(resources.googleMap)
    }
  }, [managedLifecycle])
  const mapReadyRef = useRef(false)
  const currentModeRef = useRef(null)
  const center = location ? { lat: location?.lat, lng: location?.lng } : mapControls?.defaultPosition
  const [googleReady, setGoogleReady] = useState(false)

  const units = {
    mi: 1609,
    km: 1000
  }

  const circleGeoJsonToData = useCallback((feature) => {
    if (!feature?.geometry?.coordinates) return null
    const coords = feature.geometry.coordinates[0]
    if (!coords || !Array.isArray(coords) || coords.length < 4) return null

    let sumLat = 0
    let sumLng = 0
    const points = coords.slice(0, -1)
    if (points.length === 0) return null

    points.forEach(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        sumLng += coord[0]
        sumLat += coord[1]
      }
    })
    const centerLat = sumLat / points.length
    const centerLng = sumLng / points.length

    const firstPoint = coords[0]
    if (!Array.isArray(firstPoint) || firstPoint.length < 2) return null

    const R = 6371
    const dLat = (firstPoint[1] - centerLat) * Math.PI / 180
    const dLng = (firstPoint[0] - centerLng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(centerLat * Math.PI / 180) * Math.cos(firstPoint[1] * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const radio = R * c

    return {
      center: { lat: centerLat, lng: centerLng },
      radio
    }
  }, [])

  const polygonGeoJsonToData = useCallback((feature) => {
    if (!feature?.geometry?.coordinates) return null
    const coords = feature.geometry.coordinates[0]
    if (!coords || !Array.isArray(coords) || coords.length < 3) return null

    return coords.slice(0, -1).map(coord => ({
      lat: coord[1],
      lng: coord[0]
    }))
  }, [])

  const getPolygonPathPositions = useCallback((polygon) => {
    if (!polygon?.getPath) return null
    const path = polygon.getPath()
    if (!path?.getArray) return null
    const positions = path.getArray()
    if (!positions?.length) return null
    return positions
  }, [])

  const getCircleZoneData = useCallback((circle) => {
    if (!circle?.getCenter || !circle?.getRadius) return null
    const circleCenter = circle.getCenter()
    if (!circleCenter || typeof circleCenter.lat !== 'function' || typeof circleCenter.lng !== 'function') {
      return null
    }
    const lat = circleCenter.lat()
    const lng = circleCenter.lng()
    if (lat == null || lng == null) return null

    const radius = circle.getRadius()
    if (!radius || !Number.isFinite(radius)) return null

    return {
      center: { lat, lng },
      radio: radius / 1000
    }
  }, [])

  const createTerraDraw = useCallback((map, mode) => {
    if (terraDrawRef.current) {
      try {
        terraDrawRef.current.stop()
      } catch (e) {}
      terraDrawRef.current = null
    }

    const _terraDraw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({
        map,
        lib: window.google.maps
      }),
      modes: [
        new TerraDrawCircleMode({
          styles: {
            fillColor: fillStyle?.fillColor || '#FF0000',
            fillOpacity: fillStyle?.fillOpacity || 0.35,
            outlineColor: fillStyle?.strokeColor || '#FF0000',
            outlineWidth: fillStyle?.strokeWeight || 2
          }
        }),
        new TerraDrawPolygonMode({
          pointerDistance: 10,
          styles: {
            fillColor: fillStyle?.fillColor || '#FF0000',
            fillOpacity: fillStyle?.fillOpacity || 0.35,
            outlineColor: fillStyle?.strokeColor || '#FF0000',
            outlineWidth: fillStyle?.strokeWeight || 2
          }
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: false,
                coordinates: {
                  midpoints: true,
                  draggable: true
                }
              }
            },
            circle: {
              feature: {
                draggable: true,
                coordinates: {
                  midpoints: false,
                  draggable: true
                }
              }
            }
          }
        }),
        new TerraDrawRenderMode({
          modeName: 'static'
        })
      ]
    })

    _terraDraw.start()
    _terraDraw.setMode(mode)

    _terraDraw.on('finish', (id) => {
      const snapshot = _terraDraw.getSnapshot()
      const feature = snapshot.find(f => f.id === id)
      if (!feature) return

      setClearState(false)

      if (feature.properties?.mode === 'circle') {
        const circleData = circleGeoJsonToData(feature)
        if (circleData) {
          handleData(circleData)
        }
      } else if (feature.properties?.mode === 'polygon') {
        const polygonData = polygonGeoJsonToData(feature)
        if (polygonData) {
          handleData(polygonData)
        }
      }

      _terraDraw.setMode('select')
    })

    _terraDraw.on('change', (ids, changeType) => {
      if (changeType === 'update') {
        const snapshot = _terraDraw.getSnapshot()
        ids.forEach(id => {
          const feature = snapshot.find(f => f.id === id)
          if (!feature) return

          if (feature.properties?.mode === 'circle') {
            const circleData = circleGeoJsonToData(feature)
            if (circleData) handleData(circleData)
          } else if (feature.properties?.mode === 'polygon') {
            const polygonData = polygonGeoJsonToData(feature)
            if (polygonData) handleData(polygonData)
          }
        })
      }
    })

    terraDrawRef.current = _terraDraw
    return _terraDraw
  }, [fillStyle, circleGeoJsonToData, polygonGeoJsonToData, handleData, setClearState])

  const onCircleCenterChanged = () => {
    const circleData = getCircleZoneData(circleZone)
    if (!circleData) return
    handleData(circleData)
  }

  /**
   * Method to control the data when radius of circle is changed.
   */
  const onCircleRadiusChanged = () => {
    const circleData = getCircleZoneData(circleZone)
    if (!circleData) return
    handleData(managedLifecycle
      ? circleData
      : {
          ...data,
          radio: circleData.radio
        })
  }

  /**
   * Method to control the data when polygon is changed.
   */
  const onPoygonPathChanged = () => {
    const positions = getPolygonPathPositions(polygonZone)
    if (!positions) return

    const data = positions.map(pos => ({
      lat: pos.lat(),
      lng: pos.lng()
    }))
    handleData(data)
  }

  useEffect(() => {
    if (googleReady && infoWindow) {
      infoWindow.setContent(infoContentString)
      if (data?.center) {
        infoWindow.setPosition(data.center)
      }
      if (data?.distance) {
        infoWindow.setPosition(center)
      }
    }
  }, [infoWindow, infoContentString, data, googleReady])

  useEffect(() => {
    if (!circleZone) return

    const circleData = getCircleZoneData(circleZone)
    if (circleData) {
      handleData(circleData)
    }

    const centerListener = window.google.maps.event.addListener(circleZone, 'center_changed', onCircleCenterChanged)
    const radiusListener = window.google.maps.event.addListener(circleZone, 'radius_changed', onCircleRadiusChanged)

    return () => {
      window.google.maps.event.removeListener(centerListener)
      window.google.maps.event.removeListener(radiusListener)
    }
  }, [circleZone])

  useEffect(() => {
    if (distanceBased && !clearState && data?.distance && data?.distance?.toString().slice(-1) !== '.') {
      handleData({
        ...data,
        distance: distanceBased.getRadius() / units[data?.unit]
      })
    }
    if ((distanceBased && clearState) || (distanceBased && !clearState && data?.distance && data?.distance?.toString().slice(-1) === '.')) {
      handleData(data)
    }
  }, [distanceBased])

  useEffect(() => {
    if (!polygonZone) return

    const positions = getPolygonPathPositions(polygonZone)
    if (positions) {
      const data = positions.map(pos => ({
        lat: pos.lat(),
        lng: pos.lng()
      }))
      handleData(data)
    }

    const listener = window.google.maps.event.addListener(polygonZone, 'mouseup', onPoygonPathChanged)
    return () => {
      window.google.maps.event.removeListener(listener)
    }
  }, [polygonZone])

  useEffect(() => {
    if (!window.google?.maps) return
    if (clearState) {
      if (circleZone) {
        circleZone.setMap(null)
        setCircleZone(null)
        infoWindow && infoWindow.close()
      }
      if (polygonZone) {
        polygonZone.setMap(null)
        setPolygonZone(null)
      }
      if (distanceBased) {
        distanceBased.setMap(null)
        setDistanceBased(null)
      }
      if (googleMap) {
        const drawingEnabled = isDriverGroup ?? (disabled && type !== 5)
        if (drawingEnabled && (type === 1 || type === 2)) {
          const newMode = type === 1 ? 'circle' : 'polygon'
          createTerraDraw(googleMap, newMode)
        } else if (terraDrawRef.current) {
          terraDrawRef.current.clear()
          terraDrawRef.current.setMode('static')
        }
      }
      setClearState(false)
    }
  }, [clearState, googleMap, type, disabled, isDriverGroup, createTerraDraw])

  useEffect(() => {
    if (!googleReady || !googleMap) return
    const bounds = new window.google.maps.LatLngBounds()
    if (circleZone) {
      bounds.union(circleZone.getBounds())
      googleMap.fitBounds(bounds)
    }
    if (distanceBased) {
      bounds.union(distanceBased.getBounds())
      googleMap.fitBounds(bounds)
    }
    if (polygonZone && Array.isArray(data)) {
      for (const position of data) {
        bounds.extend(position)
      }
      googleMap.fitBounds(bounds)
    }
  }, [googleReady, data, type, googleMap, circleZone, polygonZone, distanceBased])

  useEffect(() => {
    if (googleReady) {
      center.lat = location?.lat
      center.lng = location?.lng
      if (center.lat && center.lng) {
        googleMapMarker && googleMapMarker.setPosition(new window.google.maps.LatLng(center?.lat, center?.lng))
        googleMap && googleMap.panTo(new window.google.maps.LatLng(center?.lat, center?.lng))
      }
    }
  }, [location])

  useEffect(() => {
    if (!googleMap || !Array.isArray(kmlData) || !kmlData.length || !isAddMode) return
    const polygon = new window.google.maps.Polygon({
      ...fillStyle,
      draggable: false,
      map: googleMap,
      paths: kmlData
    })
    polygon.setMap(googleMap)
    const bounds = new window.google.maps.LatLngBounds()
    for (const position of kmlData) {
      bounds.extend(position)
    }
    googleMap.fitBounds(bounds)
    setPolygonZone(polygon)
  }, [isAddMode, kmlData, googleMap])

  useEffect(() => {
    if (!googleMap || !window.google?.maps) return

    const initTerraDraw = () => {
      if (terraDrawRef.current) return
      mapReadyRef.current = true

      try {
        const drawingEnabled = isDriverGroup ?? (disabled && type !== 5)
        const initialMode = type === 1 ? 'circle' : (type === 2 ? 'polygon' : 'static')

        if (drawingEnabled && (type === 1 || type === 2)) {
          currentModeRef.current = initialMode
          createTerraDraw(googleMap, initialMode)
        }
      } catch (error) {}
    }

    const listener = window.google.maps.event.addListenerOnce(googleMap, 'idle', initTerraDraw)

    return () => {
      window.google.maps.event.removeListener(listener)
    }
  }, [googleMap, createTerraDraw])

  useEffect(() => {
    if (!googleMap || !window.google?.maps || !mapReadyRef.current) return
    if (!divRef.current) return

    const drawingEnabled = isDriverGroup ?? (disabled && type !== 5)
    const newMode = type === 1 ? 'circle' : (type === 2 ? 'polygon' : 'static')

    if (currentModeRef.current === newMode) return

    if (drawingEnabled && (type === 1 || type === 2)) {
      currentModeRef.current = newMode
      createTerraDraw(googleMap, newMode)
    } else if (terraDrawRef.current) {
      try {
        terraDrawRef.current.stop()
        terraDrawRef.current = null
        currentModeRef.current = null
      } catch (e) {}
    }
  }, [type, googleMap, disabled, isDriverGroup, createTerraDraw])

  useEffect(() => {
    if (!googleReady || !window.google?.maps) return
    if (googleMap) return

    try {
      const map = new window.google.maps.Map(divRef.current, {
        zoom: location?.zoom ?? mapControls.defaultZoom,
        center,
        zoomControl: mapControls?.zoomControl,
        clickableIcons: mapControls?.clickableIcons,
        streetViewControl: mapControls?.streetViewControl,
        fullscreenControl: mapControls?.fullscreenControl,
        mapTypeControl: mapControls?.mapTypeControl,
        mapTypeId: mapControls?.mapTypeId,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_LEFT,
          ...mapControls?.mapTypeControlOptions
        }
      })

      let marker = null
      setGoogleMap(map)
      marker = isDriverGroup
        ? null
        : new window.google.maps.Marker({
          position: new window.google.maps.LatLng(center?.lat, center?.lng),
          map,
          draggable: !!mapControls?.isMarkerDraggable
        })
      setGoogleMapMarker(marker)

      if (data) {
        const _infoWindow = new window.google.maps.InfoWindow({
          content: infoContentString,
          position: data.center
        })
        setInfoWindow(_infoWindow)

        if (type === 1 && data?.center?.lat != null && data?.center?.lng != null && data?.radio != null) {
          const circle = new window.google.maps.Circle({
            ...fillStyle,
            editable: disabled,
            draggable: true,
            map,
            center: data.center,
            radius: data.radio * 1000
          })
          setCircleZone(circle)
          if (!managedLifecycle || infoContentString) _infoWindow.open(map)
        }
        if (type === 2 && Array.isArray(data) && data.length > 0) {
          const polygon = new window.google.maps.Polygon({
            ...fillStyle,
            editable: disabled,
            draggable: false,
            map,
            paths: data
          })
          setPolygonZone(polygon)
        }
        if (type === 5 && data?.distance) {
          const newCircleZone = new window.google.maps.Circle({
            ...fillStyle,
            editable: false,
            center,
            radius: data.distance * units[data?.unit]
          })
          newCircleZone.setMap(map)
          setDistanceBased(newCircleZone)
          if (!managedLifecycle || infoContentString) _infoWindow.open(map)
        }
      }
      if (isAddMode) {
        const bounds = new window.google.maps.LatLngBounds()
        for (const deliveryZone of businessZones) {
          if (deliveryZone.type === 1 && deliveryZone?.data?.center && deliveryZone?.data?.radio) {
            const newCircleZone = new window.google.maps.Circle({
              ...greenFillStyle,
              editable: false,
              center: deliveryZone?.data.center,
              radius: deliveryZone?.data.radio * 1000
            })
            newCircleZone.setMap(map)
            bounds.union(newCircleZone.getBounds())
            map.fitBounds(bounds)
          }
          if (deliveryZone.type === 5 && deliveryZone?.data?.distance) {
            const newCircleZone = new window.google.maps.Circle({
              ...greenFillStyle,
              editable: false,
              center,
              radius: deliveryZone?.data.distance * units[deliveryZone?.data?.unit]
            })
            newCircleZone.setMap(map)
            bounds.union(newCircleZone.getBounds())
            map.fitBounds(bounds)
          }
          if (deliveryZone?.type === 2 && Array.isArray(deliveryZone?.data)) {
            const newPolygonZone = new window.google.maps.Polygon({
              ...greenFillStyle,
              editable: false,
              paths: deliveryZone?.data
            })
            newPolygonZone.setMap(map)
            if (Array.isArray(deliveryZone?.data)) {
              for (const position of deliveryZone?.data) {
                bounds.extend(position)
              }
              map.fitBounds(bounds)
            }
          }
        }
      }
    } catch (error) {}
  }, [googleReady, distance])

  /**
   * append google map script
   */
  useEffect(() => {
    if (!apiKey) {
      return
    }
    let checker = null
    if (window.document.getElementById('__googleMapsScriptId')) {
      if (typeof google !== 'undefined') {
        setGoogleReady(true)
      } else {
        checker = setInterval(() => {
          if (typeof google !== 'undefined') {
            setGoogleReady(true)
            clearInterval(checker)
          }
        }, 100)
      }
      return
    }

    window.googleAsyncInit = () => {
      setGoogleReady(true)
    }

    const js = window.document.createElement('script')
    js.id = '__googleMapsScriptId'
    js.async = true
    js.defer = true
    js.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&callback=googleAsyncInit`

    window.document.body.appendChild(js)
    return () => {
      if (checker) {
        clearInterval(checker)
      }
    }
  }, [apiKey])

  return (
    googleReady && (
      <div
        id='map'
        ref={divRef}
        style={{ width: '70%', height: '50%', position: 'absolute' }}
      />
    )
  )
}

BusinessZoneGoogleMaps.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * maxLimitLocation, max value to set position
   */
  maxLimitLocation: PropTypes.number,
  /**
   * handleChangeAddressMap, function to set address when pin is moved
   */
  handleChangeAddressMap: PropTypes.func
}

BusinessZoneGoogleMaps.propTypes = {
  /**
   * You Google Maps api key
   * @see apiKey What is Api Key ? https://developers.google.com/maps/gmp-get-started
   */
  apiKey: PropTypes.string.isRequired
}
