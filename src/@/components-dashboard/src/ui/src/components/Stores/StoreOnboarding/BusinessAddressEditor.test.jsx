import React, { useState } from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessAddressEditor } from './BusinessAddressEditor'
import { businessPayload, createDraft } from '../../../../../utils/storeOnboarding'
const env = vi.hoisted(() => ({ widgets: [], maps: [], config: { loading: false, fetchedWithToken: true, configs: { google_maps_api_key: { value: 'native-key' } } }, refresh: vi.fn(async () => {}) }))
vi.mock('../../../../../contexts/ConfigContext', () => ({ useConfig: () => [env.config, { refreshConfigs: env.refresh }] }))
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))
vi.mock('../../../../../index', async () => ({
  useConfig: () => [env.config, { refreshConfigs: env.refresh }],
  useLanguage: () => [{}, (key, fallback) => fallback],
  GoogleAutocompleteInput: (await import('../../../../../components/GoogleAutocompleteInput')).GoogleAutocompleteInput,
  GoogleMapsMap: (await import('../../../../../components/GoogleMaps')).GoogleMapsMap
}))
vi.mock('../../../../../contexts/UtilsContext', () => ({ useUtils: () => [{ optimizeImage: value => value }] }))
vi.mock('../../../../../contexts/EventContext', () => ({ useEvent: () => [{ emit: vi.fn() }] }))
const install = () => {
  for (const id of ['__googleMapsScriptId', 'google-maps-cluster', 'google-maps-heatmap']) { const script = document.createElement('script'); script.id = id; document.head.append(script) }
  class Autocomplete {
    constructor () { this.remove = vi.fn(); env.widgets.push(this) }
    setComponentRestrictions (value) { this.restrictions = value }
    addListener (event, callback) { this.callback = callback; return { remove: this.remove } }
    getPlace () { return { formatted_address: 'Native selected address', address_components: [], place_id: 'native-place', geometry: { location: { lat: () => 0, lng: () => 2 } } } }
  }
  const listeners = new WeakMap()
  const event = {
    addListener: (object, type, callback) => {
      const events = listeners.get(object) || {}; listeners.set(object, events); (events[type] ||= []).push(callback)
      return { remove: () => { events[type] = events[type].filter(fn => fn !== callback) } }
    },
    clearListeners: (object, type) => { if (listeners.has(object)) listeners.get(object)[type] = [] }
  }
  class LatLng { constructor (lat, lng) { this.latitude = lat; this.longitude = lng } lat () { return this.latitude } lng () { return this.longitude } }
  class Map {
    constructor (element, options) { this.element = element; this.options = options; this.center = options.center; env.maps.push(this); element.replaceChildren() }
    setComponentRestrictions (value) { this.restrictions = value }
    addListener (type, callback) { return event.addListener(this, type, callback) }
    getCenter () { return new LatLng(this.center.lat, this.center.lng) }
    panTo (point) { this.center = { lat: point.lat(), lng: point.lng() }; (listeners.get(this)?.center_changed || []).forEach(fn => fn()) }
  }
  class Marker {
    constructor (options) {
      this.position = options.position; this.map = options.map; this.map.marker = this
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Move native pin'; button.disabled = !options.draggable
      button.onclick = () => { this.position = new LatLng(2, 3); (listeners.get(this)?.dragend || []).forEach(fn => fn()) }; this.map.element.append(button)
    }

    setPosition (point) { this.position = point } getPosition () { return this.position }
  }
  window.google = { maps: { Map, Marker, LatLng, event, places: { Autocomplete }, geometry: { spherical: { computeDistanceBetween: () => 0 } } } }
}
afterEach(() => {
  cleanup(); localStorage.removeItem('ordering:store-onboarding:test'); env.widgets = []; env.maps = []; env.refresh.mockClear(); env.config = { loading: false, fetchedWithToken: true, configs: { google_maps_api_key: { value: 'native-key' } } }; delete window.google
  for (const id of ['__googleMapsScriptId', 'google-maps-cluster', 'google-maps-heatmap']) document.getElementById(id)?.remove()
})
const themed = element => <ThemeProvider theme={theme}>{element}</ThemeProvider>
it('runs actual native BusinessDetails+GoogleAutocompleteInput, resumes and writes exact selected/dragged coordinates', () => {
  install(); let draft; const changed = vi.fn()
  const Harness = () => {
    const [current, setCurrent] = useState(createDraft('owner@example.com')); draft = current
    return <BusinessAddressEditor address={current.form.address} location={current.form.location} onChange={patch => { changed(patch); setCurrent(d => ({ ...d, form: { ...d.form, ...patch } })) }} />
  }
  render(themed(<Harness />)); expect(env.maps.at(-1).options.zoom).toBe(2); expect(changed).not.toHaveBeenCalled(); expect(JSON.parse(businessPayload(draft, 1).location)).toBeNull()
  expect(screen.queryByText(/current location|coordinates|latitude/i)).toBeNull(); expect(screen.queryByText('Google place ID')).toBeNull()
  act(() => env.widgets[0].callback()); expect(env.maps.at(-1).options.zoom).toBe(15); expect(env.maps.at(-1).marker.getPosition().lat()).toBe(0); expect(screen.getByLabelText('Address').value).toBe('Native selected address'); expect(JSON.parse(businessPayload(draft, 1).location)).toEqual({ lat: 0, lng: 2 })
  fireEvent.click(screen.getByText('Move native pin')); expect(JSON.parse(businessPayload(draft, 1).location)).toEqual({ lat: 2, lng: 3 })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Different text' } }); expect(draft.form.location).toBeNull(); expect(draft.form.address).toBe('Different text')
})
it('freezes native fields/callbacks and ignores callbacks after step unmount', () => {
  install(); const changed = vi.fn(); const view = render(themed(<BusinessAddressEditor address='Saved address' location={{ lat: 1, lng: 2 }} disabled onChange={changed} />))
  expect(screen.getByLabelText('Address')).toBeDisabled(); expect(screen.getByText('Move native pin')).toBeDisabled()
  act(() => env.widgets[0].callback()); expect(changed).not.toHaveBeenCalled()
  const widget = env.widgets[0]; view.unmount(); expect(widget.remove).toHaveBeenCalledOnce(); act(() => widget.callback()); expect(changed).not.toHaveBeenCalled()
})
it('waits for this authenticated project config instead of mounting a previous project key', () => {
  env.config = { loading: true, fetchedWithToken: false, configs: { google_maps_api_key: { value: 'previous' } } }
  const view = render(themed(<BusinessAddressEditor address='' location={null} onChange={vi.fn()} />)); expect(screen.getByRole('status')).toBeTruthy(); expect(env.widgets).toHaveLength(0)
  env.config = { ...env.config, loading: false }; view.rerender(themed(<BusinessAddressEditor address='' location={null} onChange={vi.fn()} />)); fireEvent.click(screen.getByText('Try again')); expect(env.refresh).toHaveBeenCalledOnce(); expect(env.widgets).toHaveLength(0)
})

it('does not reuse a previous project SDK; offers a page reload and retains the saved draft', () => {
  install()
  document.getElementById('__googleMapsScriptId').src = 'https://maps.googleapis.com/maps/api/js?key=previous-project-key&libraries=places,geometry'
  localStorage.setItem('ordering:store-onboarding:test', 'saved-draft')
  const changed = vi.fn()
  render(themed(<BusinessAddressEditor address='Saved address' location={{ lat: 1, lng: 2 }} onChange={changed} />))
  expect(env.widgets).toHaveLength(0); expect(env.maps).toHaveLength(0)
  expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(changed).not.toHaveBeenCalled(); expect(localStorage.getItem('ordering:store-onboarding:test')).toBe('saved-draft')
  localStorage.removeItem('ordering:store-onboarding:test')
})

it('does not trust hydrated public settings until the current authenticated fetch is confirmed', () => {
  install(); delete env.config.fetchedWithToken
  render(themed(<BusinessAddressEditor address='Saved address' location={{ lat: 1, lng: 2 }} onChange={vi.fn()} />))
  expect(env.widgets).toHaveLength(0); expect(env.maps).toHaveLength(0)
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(env.refresh).toHaveBeenCalledOnce()
})
