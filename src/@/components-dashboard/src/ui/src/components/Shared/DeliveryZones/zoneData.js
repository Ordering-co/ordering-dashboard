// redesign DG-B2a (decisión 3): what the zones overview map reads from a zone the API returns. Pure: no React, no Google.
//
// Zone types of the dashboard: 1 circle (`data: { center: { lat, lng }, radio: km }`), 2 polygon (`data: [{ lat, lng }]`),
// 4 everywhere (no shape), 5 distance based (`data: { distance: '3', unit: 'km' }`, one circle around each store). Type 3 is
// not offered by the editor any more: it is ignored everywhere.

export const DEFAULT_MAP_CENTER = { lat: 40.7747, lng: -73.9654 } // where BusinessZoneGoogleMaps has always opened
export const DEFAULT_MAP_ZOOM = 8

// Meters in one unit of `data.unit`. `km` is also what a missing unit means.
const METERS = { km: 1000, mi: 1609.34 }

const KINDS = { 1: 'circle', 2: 'polygon', 4: 'everywhere', 5: 'distance' }
const LABELS = {
  circle: ['CIRCLE', 'Circle'],
  polygon: ['POLYGON', 'Polygon'],
  everywhere: ['EVERYWHERE', 'Everywhere'],
  distance: ['DISTANCE_BASED', 'Distance based']
}

const toNumber = value => (value === null || value === undefined || value === '' ? NaN : Number(value))

const point = value => {
  const lat = toNumber(value?.lat)
  const lng = toNumber(value?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

export const zoneKind = (zone) => KINDS[Number(zone?.type)] ?? null

export const zoneTypeLabel = (zone, t) => {
  const label = LABELS[zoneKind(zone)]
  return label ? t(label[0], label[1]) : ''
}

const unitOf = (zone) => (zone?.data?.unit === 'mi' ? 'mi' : 'km')

const distanceOf = (zone) => {
  const distance = toNumber(zone?.data?.distance)
  return Number.isFinite(distance) && distance > 0 ? distance : null
}

// «1 km»: the distance of a distance-based zone with its unit. The other types have no distance.
export const zoneDistanceText = (zone) => {
  if (zoneKind(zone) !== 'distance') return ''
  const raw = zone?.data?.distance
  if (raw === null || raw === undefined || String(raw).trim() === '') return ''
  return `${String(raw).trim()} ${unitOf(zone)}`
}

export const visibleZones = (zones) => (Array.isArray(zones) ? zones.filter(zone => Number(zone?.type) !== 3) : [])

/**
 * What the map draws, in the order of the zones. Each shape: `key`, `zoneId`, `kind` (`circle`, `polygon`, `distance`),
 * `enabled` (false only when the zone says `enabled: false`) and its geometry: `center` + `radius` (meters) for circles,
 * `path` for polygons. A distance shape also carries the `businessId` it surrounds. A zone whose shape is incomplete
 * draws nothing: the map never throws on data it cannot read.
 */
export const zoneShapes = (zones, businesses) => {
  const stores = (Array.isArray(businesses) ? businesses : [])
    .map(business => ({ id: business?.id, center: point(business?.location) }))
    .filter(store => store.center)
  const shapes = []
  for (const zone of visibleZones(zones)) {
    const base = { zoneId: zone.id, enabled: zone.enabled !== false }
    const kind = zoneKind(zone)
    if (kind === 'circle') {
      const center = point(zone.data?.center)
      const radio = toNumber(zone.data?.radio)
      if (center && Number.isFinite(radio) && radio > 0) {
        shapes.push({ key: `${zone.id}:circle`, ...base, kind, center, radius: radio * METERS.km })
      }
    } else if (kind === 'polygon') {
      const path = (Array.isArray(zone.data) ? zone.data : []).map(point).filter(Boolean)
      if (path.length >= 3) shapes.push({ key: `${zone.id}:polygon`, ...base, kind, path })
    } else if (kind === 'distance') {
      const distance = distanceOf(zone)
      if (!distance) continue
      for (const store of stores) {
        shapes.push({
          key: `${zone.id}:distance:${store.id}`,
          ...base,
          kind,
          businessId: store.id,
          center: store.center,
          radius: distance * METERS[unitOf(zone)]
        })
      }
    }
  }
  return shapes
}

// Where the map opens when nothing is drawable: the first store with a location (at its own zoom), or the default place.
export const mapFallback = (businesses) => {
  for (const business of Array.isArray(businesses) ? businesses : []) {
    const center = point(business?.location)
    if (!center) continue
    const zoom = toNumber(business.location.zoom)
    return { center, zoom: Number.isFinite(zoom) ? zoom : DEFAULT_MAP_ZOOM }
  }
  return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
}
