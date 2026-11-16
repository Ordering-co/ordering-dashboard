import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  mapFallback,
  visibleZones,
  zoneDistanceText,
  zoneKind,
  zoneShapes,
  zoneTypeLabel
} from '../zoneData'

// redesign DG-B2a (decisión 3): what the zones overview map reads from a zone the API returns. Pure: no Google, no React.
const circle = { id: 1, name: 'Downtown', type: 1, enabled: true, data: { center: { lat: 40.7, lng: -74 }, radio: 2 } }
const polygon = {
  id: 2,
  name: 'Uptown',
  type: 2,
  enabled: true,
  data: [{ lat: 40.8, lng: -73.9 }, { lat: 40.8, lng: -73.8 }, { lat: 40.9, lng: -73.85 }]
}
const unused = { id: 3, name: 'Legacy', type: 3, enabled: true, data: {} }
const everywhere = { id: 4, name: 'All', type: 4, enabled: true, data: {} }
const distance = { id: 5, name: 'Near', type: 5, enabled: true, data: { distance: '3', unit: 'km' } }
const stores = [
  { id: 10, name: 'North', location: { lat: 41, lng: -73, zoom: 12 } },
  { id: 11, name: 'South', location: { lat: 40, lng: -74, zoom: 10 } },
  { id: 12, name: 'No place' }
]

describe('zoneKind', () => {
  it.each([
    [circle, 'circle'],
    [polygon, 'polygon'],
    [everywhere, 'everywhere'],
    [distance, 'distance']
  ])('names the shape of %j', (zone, kind) => {
    expect(zoneKind(zone)).toBe(kind)
  })

  it('has no kind for type 3, an unknown type or no zone', () => {
    expect(zoneKind(unused)).toBeNull()
    expect(zoneKind({ type: 9 })).toBeNull()
    expect(zoneKind({})).toBeNull()
    expect(zoneKind(null)).toBeNull()
    expect(zoneKind(undefined)).toBeNull()
  })

  it('reads a type that arrives as text', () => {
    expect(zoneKind({ type: '5' })).toBe('distance')
  })
})

describe('zoneTypeLabel', () => {
  it('asks for the keys the zone editor already uses', () => {
    const keys = []
    const t = (key, fallback) => { keys.push(key); return fallback }
    expect([circle, polygon, everywhere, distance].map(zone => zoneTypeLabel(zone, t))).toEqual(
      ['Circle', 'Polygon', 'Everywhere', 'Distance based']
    )
    expect(keys).toEqual(['CIRCLE', 'POLYGON', 'EVERYWHERE', 'DISTANCE_BASED'])
  })

  it('is empty for a type without a label', () => {
    expect(zoneTypeLabel(unused, (_key, fallback) => fallback)).toBe('')
    expect(zoneTypeLabel(null, (_key, fallback) => fallback)).toBe('')
  })
})

describe('zoneDistanceText', () => {
  it('writes the distance of a distance-based zone with its unit', () => {
    expect(zoneDistanceText({ type: 5, data: { distance: '1', unit: 'km' } })).toBe('1 km')
    expect(zoneDistanceText({ type: 5, data: { distance: 2.5, unit: 'mi' } })).toBe('2.5 mi')
  })

  it('assumes km when the unit is missing and says nothing without a distance', () => {
    expect(zoneDistanceText({ type: 5, data: { distance: '4' } })).toBe('4 km')
    expect(zoneDistanceText({ type: 5, data: {} })).toBe('')
    expect(zoneDistanceText({ type: 5 })).toBe('')
  })

  it('says nothing for the other types', () => {
    expect(zoneDistanceText(circle)).toBe('')
    expect(zoneDistanceText(polygon)).toBe('')
    expect(zoneDistanceText(null)).toBe('')
  })
})

describe('visibleZones', () => {
  it('leaves type 3 out and keeps the order of the rest', () => {
    expect(visibleZones([circle, unused, polygon, everywhere, distance])).toEqual([circle, polygon, everywhere, distance])
  })

  it('tolerates what is not a list', () => {
    expect(visibleZones(undefined)).toEqual([])
    expect(visibleZones(null)).toEqual([])
    expect(visibleZones({})).toEqual([])
  })
})

describe('zoneShapes', () => {
  it('draws a circle in meters from the radius in km', () => {
    expect(zoneShapes([circle], [])).toEqual([
      { key: '1:circle', zoneId: 1, kind: 'circle', enabled: true, center: { lat: 40.7, lng: -74 }, radius: 2000 }
    ])
  })

  it('draws a polygon from its list of points', () => {
    const [shape] = zoneShapes([polygon], [])
    expect(shape).toMatchObject({ key: '2:polygon', zoneId: 2, kind: 'polygon', enabled: true })
    expect(shape.path).toEqual(polygon.data)
  })

  it('draws one circle around each store with a location for a distance-based zone', () => {
    const shapes = zoneShapes([distance], stores)
    expect(shapes).toEqual([
      { key: '5:distance:10', zoneId: 5, kind: 'distance', enabled: true, businessId: 10, center: { lat: 41, lng: -73 }, radius: 3000 },
      { key: '5:distance:11', zoneId: 5, kind: 'distance', enabled: true, businessId: 11, center: { lat: 40, lng: -74 }, radius: 3000 }
    ])
  })

  it('converts miles', () => {
    const [shape] = zoneShapes([{ ...distance, data: { distance: '2', unit: 'mi' } }], [stores[0]])
    expect(shape.radius).toBeCloseTo(3218.68, 2)
  })

  it('draws nothing for a distance zone with no store location, no stores or no distance', () => {
    expect(zoneShapes([distance], [stores[2]])).toEqual([])
    expect(zoneShapes([distance], [])).toEqual([])
    expect(zoneShapes([distance], undefined)).toEqual([])
    expect(zoneShapes([{ ...distance, data: { distance: '', unit: 'km' } }], stores)).toEqual([])
    expect(zoneShapes([{ ...distance, data: { distance: '0', unit: 'km' } }], stores)).toEqual([])
    expect(zoneShapes([{ ...distance, data: { distance: 'far', unit: 'km' } }], stores)).toEqual([])
  })

  it('accepts a store at latitude or longitude 0 and refuses one with null or text', () => {
    const shapes = zoneShapes([distance], [
      { id: 1, location: { lat: 0, lng: 0 } },
      { id: 2, location: { lat: null, lng: -74 } },
      { id: 3, location: { lat: 'x', lng: -74 } }
    ])
    expect(shapes.map(shape => shape.businessId)).toEqual([1])
  })

  it('does not draw type 3 or type 4', () => {
    expect(zoneShapes([unused, everywhere], stores)).toEqual([])
  })

  it('skips a circle or polygon whose shape is incomplete', () => {
    expect(zoneShapes([
      { id: 6, type: 1, data: { center: { lat: 1 }, radio: 2 } },
      { id: 7, type: 1, data: { center: { lat: 1, lng: 2 } } },
      { id: 8, type: 1, data: null },
      { id: 9, type: 2, data: [{ lat: 1, lng: 2 }, { lat: 2, lng: 3 }] },
      { id: 10, type: 2, data: 'x' }
    ], stores)).toEqual([])
  })

  it('marks a disabled zone, and only when enabled is false', () => {
    expect(zoneShapes([{ ...circle, enabled: false }], [])[0].enabled).toBe(false)
    const { enabled: _, ...noFlag } = circle
    expect(zoneShapes([noFlag], [])[0].enabled).toBe(true)
  })

  it('keeps the order of the zones', () => {
    expect(zoneShapes([distance, circle, polygon], [stores[0]]).map(shape => shape.zoneId)).toEqual([5, 1, 2])
  })
})

describe('mapFallback', () => {
  it('centers on the first store with a location, at its own zoom', () => {
    expect(mapFallback([stores[2], stores[1], stores[0]])).toEqual({ center: { lat: 40, lng: -74 }, zoom: 10 })
  })

  it('uses the default zoom when the store has none', () => {
    expect(mapFallback([{ id: 1, location: { lat: 41, lng: -73 } }])).toEqual({ center: { lat: 41, lng: -73 }, zoom: DEFAULT_MAP_ZOOM })
  })

  it('falls back to the place the map has always opened on', () => {
    expect(DEFAULT_MAP_CENTER).toEqual({ lat: 40.7747, lng: -73.9654 })
    expect(DEFAULT_MAP_ZOOM).toBe(8)
    expect(mapFallback([stores[2]])).toEqual({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
    expect(mapFallback(undefined)).toEqual({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
  })
})
