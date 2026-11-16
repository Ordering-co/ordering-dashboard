import React, { useEffect, useMemo, useRef } from 'react'

import { variables } from '~/brand/ordering.tokens.generated'
import { mapFallback, zoneShapes } from './zoneData'
import './zones-overview-map.css'

// redesign DG-B2a (decisión 3): every delivery zone of a group on one map, read only. It draws with `window.google.maps` in an element
// of its own (never id='map'), makes no requests and has no text of its own (`label` arrives translated). The caller mounts it inside
// P/MapFrame and only once the Google SDK is ready (useGoogleMapsSdk); the frame owns the height and the «Map unavailable» notice.
//
// Circle (type 1), polygon (type 2) and, for a distance-based zone (type 5), one circle around each store with a location; type 4 draws
// nothing and type 3 is ignored (zoneData.js). A click on a shape reports `onSelect(zone.id)`. The selected zone is thicker with more
// fill; a disabled one has a muted stroke and no fill. Colors are read from the tokens each time the shapes are drawn, so a tenant
// action color or the dark mode is followed; the view moves only when the zones change, never when the selection does.

// The Google API takes plain numbers and color strings, not CSS: these are its own options, not design values.
const STYLE = {
  fill: 0.18,
  fillSelected: 0.32,
  weight: 2,
  weightSelected: 3,
  strokeOpacityDisabled: 0.8
}

// The one place with a color of its own: the released value of each token, used only when the token reads empty (no stylesheet).
const FALLBACK = {
  '--od-action': variables.light['--od-action'],
  '--od-ink-400': variables.root['--od-ink-400']
}

const readToken = (name) => {
  const value = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || FALLBACK[name]
}

const styleOf = (shape, selected, colors) => {
  const weight = selected ? STYLE.weightSelected : STYLE.weight
  if (!shape.enabled) {
    return {
      strokeColor: colors.muted,
      strokeOpacity: STYLE.strokeOpacityDisabled,
      strokeWeight: weight,
      fillColor: colors.muted,
      fillOpacity: 0
    }
  }
  return {
    strokeColor: colors.action,
    strokeOpacity: 1,
    strokeWeight: weight,
    fillColor: colors.action,
    fillOpacity: selected ? STYLE.fillSelected : STYLE.fill
  }
}

export const ZonesOverviewMap = ({ zones, businesses, selectedId, onSelect, label }) => {
  if (label == null) throw new Error('ZonesOverviewMap needs a label')

  const elementRef = useRef(null)
  const mapRef = useRef(null)
  const drawnRef = useRef([])
  const fittedRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Keyed by content: a parent that rebuilds the arrays on every render neither redraws the shapes nor moves the view.
  const computedShapes = zoneShapes(zones, businesses)
  const shapesKey = JSON.stringify(computedShapes)
  const shapes = useMemo(() => computedShapes, [shapesKey])
  const computedFallback = mapFallback(businesses)
  const fallbackKey = JSON.stringify(computedFallback)
  const fallback = useMemo(() => computedFallback, [fallbackKey])

  const clearShapes = () => {
    const events = window.google?.maps?.event
    for (const shape of drawnRef.current) {
      events?.clearInstanceListeners?.(shape)
      shape.setMap(null)
    }
    drawnRef.current = []
  }

  // The map itself: made once, with the element this component owns.
  useEffect(() => {
    const maps = window.google?.maps
    const element = elementRef.current
    if (!maps?.Map || !element) return undefined
    mapRef.current = new maps.Map(element, {
      center: fallback.center,
      zoom: fallback.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    })
    return () => {
      clearShapes()
      if (mapRef.current) maps.event?.clearInstanceListeners?.(mapRef.current)
      mapRef.current = null
      fittedRef.current = null
      element.replaceChildren?.()
    }
  }, [])

  // The shapes: redrawn when the zones or the selection change; fitted only when the zones do.
  useEffect(() => {
    const maps = window.google?.maps
    const map = mapRef.current
    if (!maps || !map) return undefined
    const colors = { action: readToken('--od-action'), muted: readToken('--od-ink-400') }
    // The selected zone is built last: later shapes paint over earlier ones.
    const ordered = [...shapes.filter(shape => shape.zoneId !== selectedId), ...shapes.filter(shape => shape.zoneId === selectedId)]
    const bounds = new maps.LatLngBounds()
    for (const shape of ordered) {
      const options = {
        ...styleOf(shape, shape.zoneId === selectedId, colors),
        map,
        clickable: true,
        draggable: false,
        editable: false
      }
      const drawn = shape.kind === 'polygon'
        ? new maps.Polygon({ ...options, paths: shape.path })
        : new maps.Circle({ ...options, center: shape.center, radius: shape.radius })
      drawn.addListener('click', () => onSelectRef.current?.(shape.zoneId))
      drawnRef.current.push(drawn)
      if (shape.kind === 'polygon') shape.path.forEach(position => bounds.extend(position))
      else bounds.union(drawn.getBounds())
    }
    if (fittedRef.current !== shapes) {
      fittedRef.current = shapes
      if (shapes.length) {
        map.fitBounds(bounds)
      } else {
        map.setCenter(fallback.center)
        map.setZoom(fallback.zoom)
      }
    }
    return clearShapes
  }, [shapes, selectedId, fallback])

  return <div ref={elementRef} className='dg-zones-map' role='group' aria-label={label} />
}
