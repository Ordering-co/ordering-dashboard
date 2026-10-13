import React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BusinessZoneGoogleMaps } from './index'
const state = vi.hoisted(() => ({ drawings: [], maps: [], shapes: [], listeners: [], windows: [] }))
vi.mock('terra-draw', () => ({ TerraDraw: class { constructor () { this.stop = vi.fn(); state.drawings.push(this) } start () {} setMode () {} on () {} }, TerraDrawCircleMode: class {}, TerraDrawPolygonMode: class {}, TerraDrawSelectMode: class {}, TerraDrawRenderMode: class {} }))
vi.mock('terra-draw-google-maps-adapter', () => ({ TerraDrawGoogleMapsAdapter: class {} }))
beforeEach(() => {
  state.drawings = []; state.maps = []; state.shapes = []; state.listeners = []; state.windows = []
  const script = document.createElement('script'); script.id = '__googleMapsScriptId'; document.body.appendChild(script)
  class Shape {
    constructor (options) { this.options = options; this.setMap = vi.fn(); state.shapes.push(this) }
    getCenter () { return { lat: () => this.options.center.lat, lng: () => this.options.center.lng } }
    getRadius () { return this.options.radius }
    getBounds () { return {} }
  }
  window.google = {
    maps: {
      Map: class { constructor (element, options) { this.options = options; state.maps.push(this) } fitBounds () {} panTo () {} },
      Marker: Shape,
      Circle: Shape,
      Polygon: Shape,
      LatLng: class {},
      LatLngBounds: class { union () {} extend () {} },
      InfoWindow: class { constructor () { this.open = vi.fn(); state.windows.push(this) } close () {} setContent () {} setPosition () {} },
      MapTypeControlStyle: {},
      ControlPosition: {},
      event: { clearInstanceListeners: vi.fn(), removeListener: vi.fn(), addListener: (target, event, handler) => { state.listeners.push({ target, event, handler }); return {} }, addListenerOnce: (target, event, handler) => { handler(); return {} } }
    }
  }
})
afterEach(() => { cleanup(); document.getElementById('__googleMapsScriptId')?.remove(); delete window.google })
const props = () => ({ apiKey: 'test', mapControls: { defaultZoom: 13, zoomControl: true }, location: { lat: 0, lng: 0 }, type: 2, disabled: true, setClearState: vi.fn(), handleData: vi.fn() })
it('cleans native drawing and map resources only for the opted-in lifecycle', () => {
  const view = render(<BusinessZoneGoogleMaps {...props()} managedLifecycle />)
  expect(state.drawings).toHaveLength(1)
  const draw = state.drawings[0]; const map = state.maps[0]; const marker = state.shapes[0]
  view.unmount()
  expect(draw.stop).toHaveBeenCalledOnce()
  expect(marker.setMap).toHaveBeenCalledWith(null)
  expect(window.google.maps.event.clearInstanceListeners).toHaveBeenCalledWith(map)
})
it('preserves omitted-prop behavior for existing consumers', () => {
  const view = render(<BusinessZoneGoogleMaps {...props()} />)
  const draw = state.drawings[0]
  view.unmount()
  expect(draw.stop).not.toHaveBeenCalled()
  expect(window.google.maps.event.clearInstanceListeners).not.toHaveBeenCalled()
})
it('keeps a moved saved circle center when its radius changes in the onboarding lifecycle', () => {
  const p = props()
  render(<BusinessZoneGoogleMaps {...p} managedLifecycle isDriverGroup={false} type={1} data={{ center: { lat: 0, lng: 0 }, radio: 3 }} />)
  const circle = state.shapes.find(shape => shape.options.radius)
  circle.options.center = { lat: 4, lng: 5 }; circle.options.radius = 6000
  act(() => state.listeners.find(item => item.event === 'radius_changed').handler())
  expect(p.handleData).toHaveBeenLastCalledWith({ center: { lat: 4, lng: 5 }, radio: 6 })
  expect(state.drawings).toHaveLength(0)
})

it('does not open an empty information bubble in onboarding, while keeping default consumer behavior', () => {
  const p = props(); const data = { center: { lat: 0, lng: 0 }, radio: 3 }
  const view = render(<BusinessZoneGoogleMaps {...p} type={1} data={data} managedLifecycle isDriverGroup={false} />)
  expect(state.windows[0].open).not.toHaveBeenCalled()
  view.unmount()
  render(<BusinessZoneGoogleMaps {...p} type={1} data={data} isDriverGroup={false} />)
  expect(state.windows[1].open).toHaveBeenCalledOnce()
})
