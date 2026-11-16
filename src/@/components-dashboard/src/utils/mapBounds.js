// redesign W1-2 (T1-4) — pure map-bounds maths shared by DeliveriesLocation and DriversLocation.
// No React, no window.google: google-map-react's `fitBounds` is injected by the caller.

export const FALLBACK_LATITUDE = 40.7744146
export const FALLBACK_LONGITUDE = -73.9678064

const isCoordinate = (value, limit) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit

const isPoint = (point) =>
  point !== null && typeof point === 'object' && isCoordinate(point.lat, 90) && isCoordinate(point.lng, 180)

const toNumber = (value) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return NaN
}

const fromString = (value) => {
  const parts = value.split(',')
  if (parts.length < 2) return null
  const clean = (part) => parseFloat(part.replace(/[^-.0-9]/g, ''))
  const point = { lat: clean(parts[0]), lng: clean(parts[1]) }
  return isPoint(point) ? point : null
}

/**
 * Accepts `{lat, lng}` (numbers or numeric strings) or `"lat,lng"`.
 * Anything else (null, undefined, '', no comma, NaN, out of range) returns `fallback`.
 * Never throws; a valid result is always `{lat: number, lng: number}`.
 */
export const parseLocation = (value, fallback) => {
  try {
    if (typeof value === 'string') return fromString(value) || fallback
    if (value !== null && typeof value === 'object') {
      const point = { lat: toNumber(value.lat), lng: toNumber(value.lng) }
      return isPoint(point) ? point : fallback
    }
  } catch (e) {
    // fall through to the fallback
  }
  return fallback
}

/** Project default centre (`location_default_latitude/longitude`), same fallback as before. */
export const defaultCenter = (configs) => {
  const latitude = Number(configs?.location_default_latitude?.value)
  const longitude = Number(configs?.location_default_longitude?.value)
  const invalid = isNaN(latitude) || isNaN(longitude)
  return {
    lat: !invalid ? latitude : FALLBACK_LATITUDE,
    lng: !invalid ? longitude : FALLBACK_LONGITUDE
  }
}

/** Parses every raw location (invalid ones become `fallback`). Non-array input gives []. */
export const collectPoints = (locations, fallback) =>
  Array.isArray(locations) ? locations.map((location) => parseLocation(location, fallback)) : []

// The smallest arc of longitudes that holds every one is the circle minus its biggest gap. Usually that gap is the one that
// wraps (around ±180) and the arc is plain min..max; when a bigger gap sits in between, the arc crosses ±180 (Fiji, Chukotka):
// `sw` is the longitude after the gap and `ne` the one before it, so sw.lng > ne.lng, like google's LatLngBounds.
const longitudeArc = (lngs) => {
  const sorted = [...new Set(lngs)].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  let gap = min + 360 - max // the gap that wraps around ±180
  let arc = { sw: min, ne: max }
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] - sorted[index - 1] > gap) {
      gap = sorted[index] - sorted[index - 1]
      arc = { sw: sorted[index], ne: sorted[index - 1] }
    }
  }
  return arc
}

/** `{ne, sw}` rectangle that contains every valid point, or null when there are none. Across ±180, sw.lng > ne.lng. */
export const boundsOf = (points) => {
  const valid = Array.isArray(points) ? points.filter(isPoint) : []
  if (!valid.length) return null
  const lats = valid.map((point) => point.lat)
  const arc = longitudeArc(valid.map((point) => point.lng))
  return {
    ne: { lat: Math.max(...lats), lng: arc.ne },
    sw: { lat: Math.min(...lats), lng: arc.sw }
  }
}

/**
 * `{bounds, center, zoom}` for the map, or null when it must not adjust (no points,
 * no size, or fitBounds gave nothing usable).
 * One point, or all equal: centre on it with `defaultZoom` (fitBounds would give zoom 1).
 */
export const boundsFor = (points, { width, height, defaultZoom, fitBounds } = {}) => {
  const bounds = boundsOf(points)
  if (!bounds) return null
  if (!(width > 0) || !(height > 0)) return null
  if (bounds.ne.lat === bounds.sw.lat && bounds.ne.lng === bounds.sw.lng) {
    return { bounds, center: { lat: bounds.ne.lat, lng: bounds.ne.lng }, zoom: defaultZoom }
  }
  if (typeof fitBounds !== 'function') return null
  const { center, zoom } = fitBounds(bounds, { width, height }) || {}
  if (!isPoint(center) || !Number.isFinite(zoom)) return null
  return { bounds, center, zoom }
}
