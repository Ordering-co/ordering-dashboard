import React, { useEffect, useRef, useState } from 'react'
import { WrapperGoogleMaps } from '../../../../../components/WrapperGoogleMaps'
import { formatStopNumbers, groupStopsByPosition } from '../../../../../utils/driverOrderRoute'
import { MapCanvas } from './styles'

const PIN_PATH = 'M 0,0 C -2,-14 -11,-17 -11,-27 A 11,11 0 1,1 11,-27 C 11,-17 2,-14 0,0 Z'
const CLUSTER_SIZES = [26, 34, 44, 56]

const circleScale = (label) => Math.max(11, 4 + label.length * 3)

const circleIcon = (color, label) => ({
  path: window.google.maps.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#FFFFFF',
  strokeWeight: 2,
  scale: circleScale(label)
})

const pinIcon = (color) => ({
  path: PIN_PATH,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#FFFFFF',
  strokeWeight: 2,
  scale: 1.32,
  anchor: new window.google.maps.Point(0, 0),
  labelOrigin: new window.google.maps.Point(0, -27)
})

const clusterStyles = (color) => CLUSTER_SIZES.map((size) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="#FFFFFF" stroke-width="2"/></svg>`
  )}`,
  width: size,
  height: size,
  textColor: '#FFFFFF',
  textSize: 11,
  fontWeight: '600'
}))

const clusterCalculator = (markers) => {
  const text = formatStopNumbers(markers.flatMap(marker => marker.stopNumbers || []))
  const index = text.length <= 2 ? 1 : text.length <= 5 ? 2 : text.length <= 9 ? 3 : 4
  return { text, index, title: markers.map(marker => marker.getTitle()).join('\n') }
}

const DriverRouteMapUI = (props) => {
  const {
    googleReady,
    stops,
    businessLocation,
    customerLocation,
    colors,
    getStopTitle,
    businessTitle,
    customerTitle
  } = props

  const canvasRef = useRef(null)
  const overlaysRef = useRef([])
  const [map, setMap] = useState(null)
  const [clustererReady, setClustererReady] = useState(false)

  useEffect(() => {
    if (!googleReady || !canvasRef.current || map) return
    setMap(new window.google.maps.Map(canvasRef.current, {
      zoom: 14,
      center: stops[0] || businessLocation || customerLocation || { lat: 0, lng: 0 },
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true
    }))
  }, [googleReady, map])

  useEffect(() => {
    if (clustererReady) return
    if (window.MarkerClusterer) {
      setClustererReady(true)
      return
    }
    const checker = setInterval(() => {
      if (window.MarkerClusterer) {
        setClustererReady(true)
        clearInterval(checker)
      }
    }, 200)
    return () => clearInterval(checker)
  }, [clustererReady])

  useEffect(() => {
    if (!map) return
    overlaysRef.current.forEach(overlay => overlay.setMap(null))
    overlaysRef.current = []
    const bounds = new window.google.maps.LatLngBounds()
    const createMarker = ({ position, icon, label, title, zIndex, fontSize = '11px' }) => {
      bounds.extend(position)
      return new window.google.maps.Marker({
        position,
        icon,
        title,
        zIndex,
        label: { text: label, color: '#FFFFFF', fontSize, fontWeight: '600' }
      })
    }
    const showOnMap = (overlay) => {
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    }

    const stopMarkers = groupStopsByPosition(stops).map((group) => {
      const label = formatStopNumbers(group.numbers)
      const marker = createMarker({
        position: { lat: group.lat, lng: group.lng },
        icon: circleIcon(colors.stop, label),
        label,
        title: group.stops.map((stop, i) => getStopTitle(stop, group.numbers[i] - 1)).join('\n'),
        zIndex: 2
      })
      marker.stopNumbers = group.numbers
      return marker
    })

    if (clustererReady) {
      const clusterer = new window.MarkerClusterer(map, stopMarkers, {
        styles: clusterStyles(colors.stop),
        calculator: clusterCalculator,
        gridSize: 40,
        zoomOnClick: true,
        averageCenter: true
      })
      overlaysRef.current.push({
        setMap: () => {
          clusterer.clearMarkers()
          clusterer.setMap(null)
        }
      })
    } else {
      stopMarkers.forEach(showOnMap)
    }

    if (businessLocation) {
      showOnMap(createMarker({ position: businessLocation, icon: pinIcon(colors.business), label: 'B', title: businessTitle, zIndex: 1, fontSize: '13px' }))
    }
    if (customerLocation) {
      showOnMap(createMarker({ position: customerLocation, icon: pinIcon(colors.customer), label: 'C', title: customerTitle, zIndex: 1, fontSize: '13px' }))
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48)
      const idle = window.google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 17) map.setZoom(17)
      })
      overlaysRef.current.push({ setMap: () => idle.remove() })
    }
  }, [map, clustererReady, stops, businessLocation, customerLocation])

  return <MapCanvas ref={canvasRef} />
}

export const DriverRouteMap = WrapperGoogleMaps(DriverRouteMapUI)
