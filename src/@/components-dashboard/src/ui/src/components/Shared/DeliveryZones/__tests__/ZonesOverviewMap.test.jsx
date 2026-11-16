// redesign DG-B2a (decisión 3): the zones overview map. It draws with a simulated window.google.maps (no network, no Google): what the
// real classes would receive is recorded, so the test reads the options each shape was built with.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { variables } from '~/brand/ordering.tokens.generated'
import { ZonesOverviewMap } from '../ZonesOverviewMap'

const made = { maps: [], circles: [], polygons: [], bounds: [], seq: 0 }

const installFakeGoogle = () => {
  class Shape {
    constructor (options) {
      this.options = options
      this.order = ++made.seq
      this.handlers = {}
      this.map = options.map ?? null
      this.setMap = vi.fn(map => { this.map = map })
    }

    addListener (name, handler) { this.handlers[name] = handler; return { remove: () => {} } }
    getBounds () { return { shape: this } }
    click () { this.handlers.click?.() }
  }
  class Circle extends Shape { constructor (options) { super(options); made.circles.push(this) } }
  class Polygon extends Shape { constructor (options) { super(options); made.polygons.push(this) } }
  class Map {
    constructor (element, options) {
      this.element = element
      this.options = options
      this.fitBounds = vi.fn()
      this.setCenter = vi.fn()
      this.setZoom = vi.fn()
      made.maps.push(this)
    }
  }
  class LatLngBounds {
    constructor () { this.points = []; this.unions = []; made.bounds.push(this) }
    extend (point) { this.points.push(point); return this }
    union (other) { this.unions.push(other); return this }
  }
  window.google = { maps: { Map, Circle, Polygon, LatLngBounds, event: { clearInstanceListeners: vi.fn() } } }
}

const circleZone = { id: 1, name: 'Downtown', type: 1, enabled: true, data: { center: { lat: 40.7, lng: -74 }, radio: 2 } }
const polygonZone = {
  id: 2,
  name: 'Uptown',
  type: 2,
  enabled: true,
  data: [{ lat: 40.8, lng: -73.9 }, { lat: 40.8, lng: -73.8 }, { lat: 40.9, lng: -73.85 }]
}
const legacyZone = { id: 3, name: 'Legacy', type: 3, enabled: true, data: {} }
const everywhereZone = { id: 4, name: 'All', type: 4, enabled: true, data: {} }
const distanceZone = { id: 5, name: 'Near', type: 5, enabled: true, data: { distance: '3', unit: 'km' } }
const stores = [
  { id: 10, name: 'North', location: { lat: 41, lng: -73, zoom: 12 } },
  { id: 11, name: 'South', location: { lat: 40, lng: -74, zoom: 10 } },
  { id: 12, name: 'No place' }
]

const shownZones = [circleZone, polygonZone]
const TOKENS = { '--od-action': 'rgb(1, 2, 3)', '--od-ink-400': 'rgb(4, 5, 6)' }

const mount = (props = {}) => render(
  <ZonesOverviewMap
    label='Delivery zones of North group'
    zones={[circleZone, polygonZone]}
    businesses={stores}
    selectedId={null}
    onSelect={() => {}}
    {...props}
  />
)

beforeEach(() => {
  made.maps = []; made.circles = []; made.polygons = []; made.bounds = []; made.seq = 0
  installFakeGoogle()
  for (const [name, value] of Object.entries(TOKENS)) document.documentElement.style.setProperty(name, value)
})

afterEach(() => {
  delete window.google
  for (const name of Object.keys(TOKENS)) document.documentElement.style.removeProperty(name)
})

describe('ZonesOverviewMap', () => {
  it('needs a label: it has no text of its own', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => mount({ label: undefined })).toThrow('ZonesOverviewMap needs a label')
    expect(() => mount({ label: null })).toThrow('ZonesOverviewMap needs a label')
    spy.mockRestore()
  })

  it('makes its own named element for the map, never id=map', () => {
    const { container } = mount()
    const element = screen.getByLabelText('Delivery zones of North group')
    expect(made.maps).toHaveLength(1)
    expect(made.maps[0].element).toBe(element)
    expect(element.id).toBe('')
    expect(container.querySelector('#map')).toBeNull()
    expect(element.className).toContain('dg-zones-map')
  })

  it('draws a circle in meters and a polygon with the colors of the tokens', () => {
    mount()
    expect(made.circles).toHaveLength(1)
    expect(made.polygons).toHaveLength(1)
    expect(made.circles[0].options).toMatchObject({
      map: made.maps[0],
      center: { lat: 40.7, lng: -74 },
      radius: 2000,
      strokeColor: 'rgb(1, 2, 3)',
      fillColor: 'rgb(1, 2, 3)',
      fillOpacity: 0.18,
      strokeWeight: 2
    })
    expect(made.polygons[0].options).toMatchObject({
      map: made.maps[0],
      paths: polygonZone.data,
      strokeColor: 'rgb(1, 2, 3)',
      fillColor: 'rgb(1, 2, 3)',
      fillOpacity: 0.18
    })
  })

  it('draws a circle around each store for a distance-based zone and nothing for types 3 and 4', () => {
    mount({ zones: [legacyZone, everywhereZone, distanceZone] })
    expect(made.circles.map(circle => [circle.options.center, circle.options.radius])).toEqual([
      [{ lat: 41, lng: -73 }, 3000],
      [{ lat: 40, lng: -74 }, 3000]
    ])
    expect(made.polygons).toHaveLength(0)
  })

  it('draws the selected zone thicker and with more fill, and builds it last so it paints on top', () => {
    mount({ zones: [circleZone, polygonZone], selectedId: 1 })
    expect(made.circles[0].options.fillOpacity).toBe(0.32)
    expect(made.circles[0].options.strokeWeight).toBe(3)
    expect(made.polygons[0].options.fillOpacity).toBe(0.18)
    expect(made.polygons[0].options.strokeWeight).toBe(2)
    expect(made.circles[0].order).toBeGreaterThan(made.polygons[0].order)
  })

  it('draws a disabled zone with the muted stroke and no fill', () => {
    mount({ zones: [{ ...circleZone, enabled: false }] })
    expect(made.circles[0].options).toMatchObject({
      strokeColor: 'rgb(4, 5, 6)',
      strokeOpacity: 0.8,
      fillOpacity: 0
    })
  })

  it('keeps a disabled zone without fill when it is selected, but thicker', () => {
    mount({ zones: [{ ...circleZone, enabled: false }], selectedId: 1 })
    expect(made.circles[0].options).toMatchObject({ strokeColor: 'rgb(4, 5, 6)', fillOpacity: 0, strokeWeight: 3 })
  })

  it('falls back to the colors of the release only when a token comes empty', () => {
    document.documentElement.style.removeProperty('--od-action')
    document.documentElement.style.removeProperty('--od-ink-400')
    mount({ zones: [circleZone, { ...polygonZone, enabled: false }] })
    expect(made.circles[0].options.strokeColor).toBe(variables.light['--od-action'])
    expect(made.circles[0].options.fillColor).toBe(variables.light['--od-action'])
    expect(made.polygons[0].options.strokeColor).toBe(variables.root['--od-ink-400'])
    expect(made.circles[0].options.strokeColor).toMatch(/^#/)
  })

  it('reports the zone when a shape is clicked, also for a distance circle', () => {
    const onSelect = vi.fn()
    mount({ zones: [circleZone, polygonZone, distanceZone], onSelect })
    made.circles[0].click()
    made.polygons[0].click()
    made.circles[2].click()
    expect(onSelect.mock.calls).toEqual([[1], [2], [5]])
  })

  it('uses the latest onSelect without drawing again, even if the arrays are new but equal', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = mount({ onSelect: first, zones: [{ ...circleZone }, { ...polygonZone }] })
    rerender(
      <ZonesOverviewMap label='Delivery zones of North group' zones={shownZones} businesses={stores} selectedId={null} onSelect={second} />
    )
    expect(made.circles).toHaveLength(1)
    made.circles[0].click()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(1)
  })

  it('fits the bounds to everything it drew', () => {
    mount({ zones: [circleZone, polygonZone] })
    const map = made.maps[0]
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    const bounds = map.fitBounds.mock.calls[0][0]
    expect(bounds.unions).toEqual([{ shape: made.circles[0] }])
    expect(bounds.points).toEqual(polygonZone.data)
  })

  it('opens on the first store when there is nothing to draw, then on the default place', () => {
    mount({ zones: [everywhereZone, legacyZone], businesses: [stores[2], stores[1]] })
    expect(made.maps[0].options).toMatchObject({ center: { lat: 40, lng: -74 }, zoom: 10 })
    expect(made.maps[0].fitBounds).not.toHaveBeenCalled()

    made.maps = []
    mount({ zones: [], businesses: [] })
    expect(made.maps[0].options).toMatchObject({ center: { lat: 40.7747, lng: -73.9654 }, zoom: 8 })
  })

  it('clears every shape when the zones change and draws the new ones', () => {
    const { rerender } = mount({ zones: [circleZone, polygonZone] })
    const [oldCircle] = made.circles
    const [oldPolygon] = made.polygons
    rerender(
      <ZonesOverviewMap label='Delivery zones of North group' zones={[distanceZone]} businesses={stores} selectedId={null} onSelect={() => {}} />
    )
    expect(oldCircle.setMap).toHaveBeenLastCalledWith(null)
    expect(oldPolygon.setMap).toHaveBeenLastCalledWith(null)
    expect(made.circles).toHaveLength(3)
    expect(made.polygons).toHaveLength(1)
    expect(made.maps).toHaveLength(1)
    expect(made.maps[0].fitBounds).toHaveBeenCalledTimes(2)
  })

  it('goes to the fallback view when the zones become nothing drawable', () => {
    const { rerender } = mount({ zones: [circleZone] })
    rerender(
      <ZonesOverviewMap label='Delivery zones of North group' zones={[everywhereZone]} businesses={stores} selectedId={null} onSelect={() => {}} />
    )
    expect(made.circles[0].setMap).toHaveBeenLastCalledWith(null)
    expect(made.maps[0].setCenter).toHaveBeenLastCalledWith({ lat: 41, lng: -73 })
    expect(made.maps[0].setZoom).toHaveBeenLastCalledWith(12)
  })

  it('restyles the selection without moving the view', () => {
    const { rerender } = mount({ zones: [circleZone, polygonZone], selectedId: null })
    const before = made.circles[0]
    rerender(
      <ZonesOverviewMap label='Delivery zones of North group' zones={[circleZone, polygonZone]} businesses={stores} selectedId={1} onSelect={() => {}} />
    )
    expect(before.setMap).toHaveBeenLastCalledWith(null)
    expect(made.circles.at(-1).options.fillOpacity).toBe(0.32)
    expect(made.circles.at(-1).options.strokeWeight).toBe(3)
    expect(made.maps[0].fitBounds).toHaveBeenCalledTimes(1)
  })

  it('leaves no shape on the map after unmounting', () => {
    const view = mount({ zones: [circleZone, polygonZone, distanceZone] })
    const shapes = [...made.circles, ...made.polygons]
    view.unmount()
    for (const shape of shapes) expect(shape.setMap).toHaveBeenLastCalledWith(null)
    expect(window.google.maps.event.clearInstanceListeners).toHaveBeenCalled()
  })

  it('does not fail when Google is not there: the frame decides what to show', () => {
    delete window.google
    expect(() => mount()).not.toThrow()
    expect(screen.getByLabelText('Delivery zones of North group')).toBeTruthy()
  })
})
