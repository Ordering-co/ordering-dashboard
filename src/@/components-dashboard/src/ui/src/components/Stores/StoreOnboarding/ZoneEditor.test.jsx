import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { ZoneEditor } from './ZoneEditor'
const native = vi.hoisted(() => ({ props: null, mounts: 0 }))
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))
vi.mock('./styles', () => ({ ZoneMapFrame: 'div', Field: 'label', Button: 'button', TextButton: 'button', Row: 'div' }))
vi.mock('./useOnboardingMaps', () => ({ useOnboardingMaps: key => ({ status: key ? 'ready' : 'error', retry: vi.fn() }) }))
vi.mock('../../../../../components/BusinessZoneGoogleMaps', () => ({ BusinessZoneGoogleMaps: props => { native.props = props; React.useEffect(() => { native.mounts++ }, []); return <div>Native zone map</div> } }))
afterEach(() => { cleanup(); native.props = null; native.mounts = 0 })
const themed = element => <ThemeProvider theme={theme}>{element}</ThemeProvider>
const renderZone = props => render(themed(<ZoneEditor apiKey='test' location={{ lat: 0, lng: 0 }} onChange={vi.fn()} {...props} />))
it('shows the whole world with native zoom controls for Everywhere', () => {
  renderZone({ type: 4 })
  expect(screen.getByText('Native zone map')).toBeTruthy()
  expect(native.props.mapControls).toMatchObject({ zoomControl: true, defaultZoom: 0 })
  expect(native.props.location).toEqual({ lat: 0, lng: 0, zoom: 0 })
})
it('keeps the native drawing session and latest callback when a polygon is completed', () => {
  const first = vi.fn(); const latest = vi.fn()
  const view = renderZone({ type: 2, data: [], onChange: first })
  const handler = native.props.handleData
  const polygon = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }]
  handler(polygon); expect(first).toHaveBeenCalledWith(polygon)
  view.rerender(themed(<ZoneEditor apiKey='test' type={2} data={polygon} location={{ lat: 0, lng: 0 }} onChange={latest} />))
  expect(native.mounts).toBe(1)
  expect(native.props.isDriverGroup).toBeUndefined()
  handler([...polygon, { lat: 0, lng: 1 }]); expect(latest).toHaveBeenCalledOnce()
})
it('preserves saved geometry on native initialization and unrelated edits; blocks stale events after unmount', () => {
  const changed = vi.fn(); const data = { center: { lat: 0, lng: 0 }, radio: 1.609344 }
  const view = renderZone({ type: 1, data, distanceUnit: 'mi', onChange: changed })
  const handler = native.props.handleData
  expect(native.props.isDriverGroup).toBe(false)
  handler({ ...data, radio: data.radio + 1e-12 }); expect(changed).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Radius (mi)').value).toBe('1')
  view.unmount(); handler({ ...data, radio: 9 }); expect(changed).not.toHaveBeenCalled()
})
it('converts an explicit radius edit to API kilometers and remounts the native shape', () => {
  const changed = vi.fn(); const data = { center: { lat: 0, lng: 0 }, radio: 1.609344 }
  renderZone({ type: 1, data, distanceUnit: 'mi', onChange: changed })
  fireEvent.change(screen.getByLabelText('Radius (mi)'), { target: { value: '2' } })
  expect(changed).toHaveBeenCalledWith({ center: data.center, radio: 3.218688 })
})
it('prevents native events from changing a frozen draft', () => {
  const changed = vi.fn(); renderZone({ type: 2, data: [], disabled: true, onChange: changed })
  native.props.handleData([{ lat: 0, lng: 0 }]); expect(changed).not.toHaveBeenCalled()
})
it('retains manual polygon recovery without a Maps key', () => {
  const changed = vi.fn(); renderZone({ apiKey: '', type: 2, data: [null, { lat: 1, lng: 2 }], onChange: changed })
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.getByText('Add point').disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '4' } })
  fireEvent.click(screen.getByText('Add point'))
  expect(changed).toHaveBeenCalledWith([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }])
})
it.each([
  { type: 1, before: { center: { lat: 0, lng: 0 }, radio: 5 }, after: { center: { lat: 0, lng: 0 }, radio: 7 }, edit: () => fireEvent.change(screen.getByLabelText('Radius (km)'), { target: { value: '7' } }) },
  { type: 2, before: [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }], after: [], edit: () => fireEvent.click(screen.getByText('Clear')) }
])('rebuilds native geometry from the committed value after a delayed save (type $type)', ({ type, before, after, edit }) => {
  const changed = vi.fn()
  const view = renderZone({ type, data: before, onChange: changed })
  edit()
  expect(changed).toHaveBeenCalledWith(after)

  view.rerender(themed(<ZoneEditor apiKey='test' type={type} data={after} location={{ lat: 0, lng: 0 }} onChange={changed} />))
  expect(native.props.data).toEqual(after)
  expect(native.mounts).toBe(2)
  if (type === 2) expect(native.props.isDriverGroup).toBeUndefined()
})
it('replaces native geometry when another tab commits a different saved zone', () => {
  const before = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }]
  const after = [{ lat: 2, lng: 2 }, { lat: 3, lng: 2 }, { lat: 3, lng: 3 }]
  const changed = vi.fn(); const view = renderZone({ type: 2, data: before, onChange: changed })
  view.rerender(themed(<ZoneEditor apiKey='test' type={2} data={after} location={{ lat: 0, lng: 0 }} onChange={changed} />))
  expect(native.props.data).toEqual(after)
  expect(native.mounts).toBe(2)
  expect(changed).not.toHaveBeenCalled()
})
it('keeps a native drawing session while multiple delayed native edits are acknowledged', () => {
  const one = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }]
  const two = [...one, { lat: 0, lng: 1 }]
  const changed = vi.fn(); const view = renderZone({ type: 2, data: [], onChange: changed })
  native.props.handleData(one); native.props.handleData(two)
  for (const data of [one, two]) view.rerender(themed(<ZoneEditor apiKey='test' type={2} data={data} location={{ lat: 0, lng: 0 }} onChange={changed} />))
  expect(native.mounts).toBe(1)
})

it('does not pan back to the store when a save clones unchanged location coordinates', () => {
  const location = { lat: 19, lng: -99 }
  const data = { center: location, radio: 5 }; const after = { center: { lat: 19.1, lng: -99.1 }, radio: 6 }
  const changed = vi.fn(); const view = renderZone({ type: 1, data, location, onChange: changed })
  const initialLocation = native.props.location
  native.props.handleData(after)
  view.rerender(themed(<ZoneEditor apiKey='test' type={1} data={after} location={{ ...location }} onChange={changed} />))
  expect(native.props.location).toBe(initialLocation)
  expect(native.mounts).toBe(1)
})

it('formats a dragged radius without rewriting its precise stored geometry', () => {
  const data = { center: { lat: 19, lng: -99 }, radio: 7.574567950194228 }
  const changed = vi.fn(); const view = renderZone({ type: 1, data, onChange: changed })
  expect(screen.getByRole('spinbutton', { name: 'Radius (km)' })).toHaveValue(7.57)
  expect(native.props.data).toEqual(data)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Radius (km)' }), { target: { value: '7.57' } })
  view.rerender(themed(<ZoneEditor apiKey='test' type={1} data={{ ...data }} location={{ lat: 0, lng: 0 }} onChange={changed} />))
  expect(native.props.data.radio).toBe(7.574567950194228)
  expect(changed).not.toHaveBeenCalled()
})
