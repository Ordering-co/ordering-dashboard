import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { WrapperGoogleMaps } from '../WrapperGoogleMaps'
import { GoogleMapsHeatmapLayer } from '../GoogleMapsHeatmapLayer'
import { useEvent } from '../../contexts/EventContext'
import { useUtils } from '../../contexts/UtilsContext'
import { fetchBusinessDetails } from '../GoogleAutocompleteInput/placesApi'

export const GoogleMaps = (props) => {
  const {
    googleReady,
    locations,
    mapControls,
    setErrors,
    isSetInputs,
    fixedLocation,
    handleChangeAddressMap,
    maxLimitLocation,
    businessMap,
    onBusinessClick,
    isHeatMap,
    isHeat,
    markerIcon,
    isFitCenter,
    handleChangeCenter,
    placeId,
    setDetails,
    onlyMarkerChangeCenter
  } = props

  const [{ optimizeImage }] = useUtils()
  const [events] = useEvent()
  const divRef = useRef()
  const [googleMap, setGoogleMap] = useState(null)
  const [googleMapMarker, setGoogleMapMarker] = useState(null)
  const [markers, setMarkers] = useState([])
  const [boundMap, setBoundMap] = useState(null)
  const [heatMap, setHeatMap] = useState(null)
  const [markerCluster, setMarkerCluster] = useState(null)
  const heatMapInitializedRef = useRef(false)

  const location = fixedLocation || props.location
  const center = { lat: location?.lat, lng: location?.lng }

  /**
   * Function to generate multiple markers
   * @param {Google map} map
   */
  const generateMarkers = (map) => {
    if (!Array.isArray(locations)) {
      console.warn('Locations must be an array')
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    let businessesNear = 0

    const validLocations = locations.filter(loc =>
      loc && typeof loc.lat !== 'undefined' &&
      typeof loc.lng !== 'undefined' &&
      !isNaN(Number(loc.lat)) &&
      !isNaN(Number(loc.lng))
    )

    for (let i = 0; i < validLocations.length; i++) {
      let formatUrl = null
      if (i === 1 || businessMap) {
        formatUrl = optimizeImage(validLocations[i]?.icon, 'r_max')
      }
      if (isHeatMap && markerIcon) {
        formatUrl = markerIcon
      }
      const marker = new window.google.maps.Marker({
        position: new window.google.maps.LatLng(Number(validLocations[i].lat), Number(validLocations[i].lng)),
        map,
        title: validLocations[i]?.slug,
        icon: validLocations[i]?.icon
          ? {
              url: formatUrl || validLocations[i].icon,
              scaledSize: new window.google.maps.Size(45, 45)
            }
          : (isHeatMap
              ? {
                  url: formatUrl,
                  scaledSize: new window.google.maps.Size(40, 40)
                }
              : null)
      })
      if (businessMap) {
        const isNear = validateResult(googleMap, marker, marker.getPosition())
        if (isNear) {
          marker.addListener('click', () => onBusinessClick(validLocations[i]?.slug))
          bounds.extend(marker.position)
          setMarkers(markers => [...markers, marker])
          businessesNear = businessesNear + 1
        } else {
          marker.setMap(null)
        }
      } else {
        bounds.extend(marker.position)
        setMarkers(markers => [...markers, marker])
      }
    }
    businessesNear === 0 && setErrors && setErrors('ERROR_NOT_FOUND_BUSINESSES')
    map?.fitBounds && map.fitBounds(bounds)
    setBoundMap(bounds)
  }

  /**
   * function to get all address information with a location
   * @param {google location} pos
   */
  const geocodePosition = (pos) => {
    if (isSetInputs) {
      const geocoder = new window.google.maps.Geocoder()

      geocoder.geocode({ latLng: pos }, (results) => {
        if (results && results.length > 0 && results?.[0]?.address_components) {
          const addressObj = {}
          const cityFallback = results[0].address_components.find(component => component.types.includes('administrative_area_level_2'))
          for (const component of results[0].address_components) {
            const addressType = component.types[0]
            if (addressType === 'postal_code') {
              addressObj.zipcode = component.short_name
            }
            if (addressType === 'street_number') {
              addressObj.street_number = component.long_name
            }
            if (addressType === 'neighborhood') {
              addressObj.neighborhood = component.long_name
            }
            if (addressType === 'route') {
              addressObj.route = component.long_name
            }
            if (addressType === 'locality') {
              addressObj.city = component.long_name || cityFallback.long_name
              addressObj.locality = component.long_name
            }
            if (component.types?.includes('sublocality')) {
              addressObj.sublocality = component.long_name
            }
            if (addressType === 'country') {
              addressObj.country = component.long_name
              addressObj.country_code = component.short_name
            }
            if (addressType === 'administrative_area_level_1') {
              addressObj.state = component.long_name
              addressObj.state_code = component.short_name
            }
          }
          const address = {
            address: results[0].formatted_address,
            location: { lat: pos?.lat(), lng: pos?.lng() },
            ...addressObj
          }

          handleChangeAddressMap && handleChangeAddressMap(address)

          center.lat = address.location?.lat
          center.lng = address.location?.lng
        } else {
          googleMapMarker && googleMapMarker.setPosition(center)
          setErrors && setErrors('ERROR_NOT_FOUND_ADDRESS')
        }
        if (center?.lat && center?.lng) {
          googleMap && googleMap.panTo(new window.google.maps.LatLng(center?.lat, center?.lng))
        }
      })
    } else {
      const location = { lat: pos?.lat(), lng: pos?.lng() }
      handleChangeAddressMap && handleChangeAddressMap({
        location
      })
      center.lat = location?.lat
      center.lng = location?.lng
      if (location.lat && location.lng) {
        googleMap && googleMap.panTo(new window.google.maps.LatLng(location?.lat, location?.lng))
      }
    }
  }

  /**
   * Function to return distance between two locations
   * @param {google location} loc1
   * @param {*google location} loc2
   */
  const validateResult = (map, marker, curPos) => {
    const loc1 = new window.google.maps.LatLng(curPos?.lat(), curPos?.lng())
    const loc2 = new window.google.maps.LatLng(location?.lat, location?.lng)

    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(loc1, loc2)

    if (businessMap) {
      const minimumBusinessDistance = 20000
      if (distance <= minimumBusinessDistance) return true
      return false
    }

    if (!maxLimitLocation) {
      onlyMarkerChangeCenter && handleChangeCenter(curPos)
      geocodePosition(curPos)
      return
    }

    if (distance <= maxLimitLocation) {
      geocodePosition(curPos)
      onlyMarkerChangeCenter && handleChangeCenter(curPos)
    } else if (center?.lat && center?.lng) {
      marker.setPosition(center)
      map.panTo(new window.google.maps.LatLng(center?.lat, center?.lng))
      setErrors && setErrors('ERROR_MAX_LIMIT_LOCATION')
    }
  }

  useEffect(() => {
    if (!heatMap || !isHeatMap) return

    const locationsData = (Array.isArray(locations) ? locations : []).filter(loc =>
      loc && !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng))
    )

    heatMap.setData(locationsData.map(location => {
      return new window.google.maps.LatLng(Number(location.lat), Number(location.lng))
    }))
  }, [locations, heatMap, isHeatMap])

  useEffect(() => {
    if (!googleReady || !googleMap || !isHeatMap || !heatMap || !markerCluster) return

    if (isHeat) {
      heatMap.setMap(googleMap)
      markerCluster.clearMarkers()
      if (Array.isArray(markers)) {
        markers.forEach(marker => marker.setMap(null))
      }
    } else {
      heatMap.setMap(null)
      if (Array.isArray(markers) && markers.length) {
        markerCluster.addMarkers(markers)
      }
    }
  }, [isHeat, googleReady, googleMap, isHeatMap, heatMap, markerCluster, markers])

  useEffect(() => {
    if (googleReady && googleMap && googleMapMarker && isFitCenter) {
      googleMap.addListener('center_changed', () => {
        const timeOUt = setTimeout(() => {
          googleMapMarker.setPosition(googleMap.getCenter())
          handleChangeCenter && handleChangeCenter(googleMap.getCenter())
        }, 200)
        return () => clearTimeout(timeOUt)
      })
    }
  }, [googleMapMarker])

  useEffect(() => {
    if (!googleReady || !window.google?.maps) return
    try {
      const map = new window.google.maps.Map(divRef.current, {
        zoom: location.zoom ?? mapControls.defaultZoom,
        center,
        zoomControl: mapControls?.zoomControl,
        streetViewControl: mapControls?.streetViewControl,
        fullscreenControl: mapControls?.fullscreenControl,
        mapTypeControl: mapControls?.mapTypeControl,
        mapTypeId: mapControls?.mapTypeId,
        mapTypeControlOptions: {
          style: window?.google?.maps?.MapTypeControlStyle?.HORIZONTAL_BAR || 'HORIZONTAL_BAR',
          position: window?.google?.maps?.ControlPosition?.TOP_LEFT || 'TOP_LEFT',
          ...mapControls?.mapTypeControlOptions
        }
      })

      let marker = null
      setGoogleMap(map)

      if (locations?.length) {
        if (businessMap) {
          marker = new window.google.maps.Marker({
            position: new window.google.maps.LatLng(center.lat, center.lng),
            map
          })
          setGoogleMapMarker(marker)
        }
        generateMarkers(map)
        marker = new window.google.maps.Marker({
          position: new window.google.maps.LatLng(center?.lat, center?.lng),
          map,
          opacity: isHeatMap ? 0 : 1
        })
        setGoogleMapMarker(marker)
      } else {
        marker = new window.google.maps.Marker({
          position: new window.google.maps.LatLng(center?.lat, center?.lng),
          map,
          draggable: !!mapControls?.isMarkerDraggable
        })
        setGoogleMapMarker(marker)
      }
    } catch (error) {
      console.error('Error initializing Google Maps:', error)
    }
  }, [googleReady])

  useEffect(() => {
    if (!isHeatMap || businessMap || !googleReady || !googleMap || !googleMapMarker || heatMapInitializedRef.current) {
      return
    }

    const initHeatMapLayer = () => {
      if (!window.h337 || !window.MarkerClusterer) return false

      const locationsData = (Array.isArray(locations) ? locations : []).filter(loc =>
        loc && !isNaN(Number(loc.lat)) && !isNaN(Number(loc.lng))
      )

      const _heatMap = new GoogleMapsHeatmapLayer({
        data: locationsData.map(location => {
          return new window.google.maps.LatLng(Number(location.lat), Number(location.lng))
        }),
        map: null,
        radius: 25
      })
      setHeatMap(_heatMap)

      const _markerCluster = new window.MarkerClusterer(googleMap, Array.isArray(markers) ? markers : [], {
        imagePath:
          'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'
      })
      setMarkerCluster(_markerCluster)
      heatMapInitializedRef.current = true

      return true
    }

    if (initHeatMapLayer()) {
      return
    }

    const checker = setInterval(() => {
      if (initHeatMapLayer()) {
        clearInterval(checker)
      }
    }, 100)

    return () => clearInterval(checker)
  }, [isHeatMap, businessMap, googleReady, googleMap, googleMapMarker, locations, markers])

  useEffect(() => {
    if (!businessMap) {
      if (googleReady && googleMap && googleMapMarker) {
        window.google.maps.event.addListener(googleMapMarker, 'dragend', () => {
          validateResult(googleMap, googleMapMarker, googleMapMarker.getPosition())
        })

        window.google.maps.event.addListener(googleMapMarker, 'drag', () => {
          events.emit('map_is_dragging', true)
        })

        if (mapControls?.isMarkerDraggable) {
          window.google.maps.event.addListener(googleMap, 'drag', () => {
            !onlyMarkerChangeCenter && googleMapMarker.setPosition(googleMap.getCenter())
            events.emit('map_is_dragging', true)
          })
          if (!onlyMarkerChangeCenter) {
            window.google.maps.event.addListener(googleMap, 'dragend', () => {
              googleMapMarker.setPosition(googleMap.getCenter())
              validateResult(googleMap, googleMapMarker, googleMap.getCenter())
            })
          }
        }

        return () => {
          window.google.maps.event.clearListeners(googleMapMarker, 'dragend')
          window.google.maps.event.clearListeners(googleMap, 'drag')
          window.google.maps.event.clearListeners(googleMap, 'dragend')
        }
      }
    }
  }, [googleMapMarker, googleMap, location])

  useEffect(() => {
    if (googleReady) {
      if (businessMap && googleMap) {
        generateMarkers(googleMap)
      }
      if (!(isHeatMap && locations?.length > 0)) {
        center.lat = location?.lat
        center.lng = location?.lng
        if (center.lat && center.lng) {
          googleMapMarker && googleMapMarker.setPosition(new window.google.maps.LatLng(center?.lat, center?.lng))
          googleMap && googleMap.panTo(new window.google.maps.LatLng(center?.lat, center?.lng))
        }
      }
    }
  }, [location])

  useEffect(() => {
    if (!businessMap && !isHeatMap) {
      const interval = setInterval(() => {
        if (googleReady && googleMap && boundMap) {
          const driverLocation = locations[0]
          if (driverLocation?.lat && driverLocation?.lng) {
            const newLocation = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng)
            if (markers[0]) markers[0].setPosition(newLocation)
            markers.forEach(marker => boundMap.extend(marker.position))
            googleMap.fitBounds(boundMap)
          }
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [locations, isHeatMap])

  useEffect(() => {
    if (googleMap && placeId) {
      let active = true
      fetchBusinessDetails(googleMap, placeId)
        .then(place => {
          if (active) setDetails && setDetails(place)
        })
        .catch(error => console.error('Google Places details request failed', error))
      return () => { active = false }
    }
  }, [googleMap, placeId])

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

GoogleMaps.propTypes = {
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

export const GoogleMapsMap = WrapperGoogleMaps(GoogleMaps)

GoogleMapsMap.propTypes = {
  /**
   * You Google Maps api key
   * @see apiKey What is Api Key ? https://developers.google.com/maps/gmp-get-started
   */
  apiKey: PropTypes.string.isRequired,
  /**
   * Function to get address from GPS
   * @param {object} address New address
   */
  onAddress: PropTypes.func,
  /**
   * Function to get error from GPS
   * @param {object} address New address
   */
  onError: PropTypes.func
}
