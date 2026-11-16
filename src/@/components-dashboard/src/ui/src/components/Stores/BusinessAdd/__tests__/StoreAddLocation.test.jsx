/* eslint-disable import/first */
// redesign stores (lote 2.3-A): the «Location» group of the store add page on Product. Covered: every label tied to
// its control; the map in P/MapFrame and its notice without a key or when Maps cannot load; a picked suggestion holds
// address, pin (with main's exact shape) and then the time zone; a failed lookup keeps the zone and says so; a late answer
// after a newer pick is ignored; text typed without picking IS held (main's behaviour) as the address alone, with the hint
// to pick one until there is a pin; dragging the pin; the city and the time zone; never the key. no Google place ID line
// (main dropped it); an address filled from outside (Google) redraws the field and moves the map.
import React, { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({
  sdk: { status: 'ready', generation: 0 },
  apiKey: 'maps-key',
  fetchTimezone: null,
  reverseGeocode: null,
  mapProps: null,
  pick: null,
  country: undefined,
  countryCode: null
}))

const fakes = vi.hoisted(() => ({
  GoogleMapsMap: (props) => {
    probe.mapProps = props
    return <div data-testid='google-map' data-lat={props.location?.lat} data-lng={props.location?.lng} />
  },
  GoogleAutocompleteInput: ({ onChangeAddress, childRef, managedLifecycle, apiKey, countryCode, ...rest }) => {
    probe.pick = onChangeAddress
    probe.countryCode = countryCode
    return <input {...rest} ref={childRef} />
  }
}))

const index = vi.hoisted(() => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: probe.apiKey }, ...(probe.country ? { country_autocomplete: { value: probe.country } } : {}) } }]
}))

vi.mock('../../../../../../index', () => ({ ...index, ...fakes }))
vi.mock('~components', () => ({ ...index, ...fakes }))
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({
  useGoogleMapsSdk: () => probe.sdk
}))
vi.mock('../../BusinessLocation/geo', () => ({
  fetchTimezone: (...args) => probe.fetchTimezone(...args),
  reverseGeocode: (...args) => probe.reverseGeocode(...args)
}))

import { StoreAddLocation } from '../StoreAddLocation'

const CITIES = [{ id: 1, name: 'Default city' }, { id: 4, name: 'Brooklyn' }]

const PLACE = {
  address: 'Calle Mayor 1, Madrid, Spain',
  location: { lat: 40.41, lng: -3.70 },
  zipcode: '28013',
  street_number: '1',
  route: 'Calle Mayor',
  map_data: { library: 'google', place_id: 'abc' }
}

const MAIN_PICK = {
  address: 'Calle Mayor 1, Madrid, Spain',
  location: { lat: 40.41, lng: -3.70, zipcode: '28013', zoom: 15 }
}

const Harness = ({ spy, initial = {}, cityId = 1, onCityChange, disabled, citiesLoading = false, addressInputRef }) => {
  const [form, setForm] = useState(initial)
  Harness.form = form
  const changeFields = (patch) => {
    spy && spy(patch)
    setForm(prev => ({ ...prev, ...patch }))
  }
  return (
    <StoreAddLocation
      form={form}
      changeFields={changeFields}
      cities={CITIES}
      citiesLoading={citiesLoading}
      cityId={cityId}
      onCityChange={onCityChange || (() => {})}
      apiKey={probe.apiKey}
      disabled={disabled}
      addressInputRef={addressInputRef}
    />
  )
}

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const latLng = (lat, lng) => ({ lat: () => lat, lng: () => lng })

beforeEach(() => {
  probe.sdk = { status: 'ready', generation: 0 }
  probe.apiKey = 'maps-key'
  probe.fetchTimezone = vi.fn().mockResolvedValue({ ok: true, timezone: 'Europe/Madrid' })
  probe.reverseGeocode = vi.fn().mockResolvedValue({ ok: true, address: 'Gran Vía 2, Madrid, Spain', zipcode: '28014' })
  probe.mapProps = null
  probe.pick = null
  probe.country = undefined
  probe.countryCode = null
})

describe('Store add › Location', () => {
  it('is a named group whose fields are tied to their labels', () => {
    render(<Harness initial={{ address: '5th Avenue', timezone: 'America/New_York' }} />)
    const group = screen.getByRole('region', { name: 'Location' })
    expect(within(group).getByRole('heading', { level: 2, name: 'Location' })).toBeTruthy()
    expect(screen.getByLabelText('Address').value).toBe('5th Avenue')
    expect(screen.getByLabelText('City').value).toBe('1')
    expect(screen.getByLabelText('Timezone').value).toBe('America/New_York')
  })

  it('draws the map in its frame, and says so in the slot when Maps cannot load or there is no key', () => {
    const { unmount } = render(<Harness initial={{ location: { lat: 40.77, lng: -73.97, zipcode: -1, zoom: 15 } }} />)
    expect(screen.getByRole('region', { name: 'Store location map' }).getAttribute('data-state')).toBe('ready')
    expect(screen.getByTestId('google-map')).toBeTruthy()
    expect(screen.getByText('Drag the pin to the store\'s entrance.')).toBeTruthy()
    unmount()
    probe.sdk = { status: 'error', error: 'map_unavailable', generation: 0 }
    const second = render(<Harness initial={{ location: { lat: 40.77, lng: -73.97, zipcode: -1, zoom: 15 } }} />)
    const frame = screen.getByRole('region', { name: 'Store location map' })
    expect(frame.getAttribute('data-state')).toBe('unavailable')
    expect(within(frame).getByText('Map unavailable')).toBeTruthy()
    expect(screen.queryByTestId('google-map')).toBeNull()
    expect(screen.getByText('Address search needs Google Maps, which is not available right now.')).toBeTruthy()
    second.unmount()
    probe.apiKey = undefined
    probe.sdk = { status: 'error', error: 'missing_map_key', generation: 0 }
    render(<Harness />)
    expect(screen.getByText('Google Maps api key is required')).toBeTruthy()
  })

  it('picking a suggestion holds the address and the pin in main\'s shape, then the time zone', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(spy).toHaveBeenNthCalledWith(1, MAIN_PICK)
    expect(probe.fetchTimezone).toHaveBeenCalledWith({ lat: 40.41, lng: -3.70 }, 'maps-key')
    expect(spy).toHaveBeenNthCalledWith(2, { timezone: 'Europe/Madrid' })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('google-map').getAttribute('data-lat')).toBe('40.41')
    expect(screen.getByLabelText('Timezone').value).toBe('Europe/Madrid')
    expect(screen.queryByText('Choose a suggestion to place the pin.')).toBeNull()
  })

  it('a pick without a postal code holds -1, as main does', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await act(async () => { probe.pick({ address: 'Somewhere', location: { lat: 1.5, lng: 2.5 } }) })
    await settle()
    expect(spy).toHaveBeenNthCalledWith(1, { address: 'Somewhere', location: { lat: 1.5, lng: 2.5, zipcode: -1, zoom: 15 } })
  })

  it('a failed time zone lookup keeps the zone, says so, and holds nothing else', async () => {
    probe.fetchTimezone = vi.fn().mockResolvedValue({ ok: false })
    const spy = vi.fn()
    render(<Harness spy={spy} initial={{ timezone: 'America/New_York' }} />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(MAIN_PICK)
    expect(Harness.form.timezone).toBe('America/New_York')
    expect(screen.getByLabelText('Timezone').value).toBe('America/New_York')
    expect(screen.getByText('We couldn\'t get the time zone of this place. Check it.')).toBeTruthy()
  })

  it('ignores a time zone answer that arrives after a newer pick', async () => {
    let resolveFirst
    probe.fetchTimezone = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ ok: true, timezone: 'America/New_York' })
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await act(async () => { probe.pick(PLACE) })
    await act(async () => { probe.pick({ ...PLACE, address: 'Other 2', location: { lat: 40.7, lng: -74 } }) })
    await settle()
    await act(async () => { resolveFirst({ ok: true, timezone: 'Europe/Madrid' }) })
    await settle()
    const zones = spy.mock.calls.map(([patch]) => patch.timezone).filter(Boolean)
    expect(zones).toEqual(['America/New_York'])
    expect(Harness.form.timezone).toBe('America/New_York')
  })

  it('holds text typed without a pick as the address alone, and asks for a suggestion until there is a pin', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    expect(screen.getByText('Choose a suggestion to place the pin.')).toBeTruthy()
    await user.type(screen.getByLabelText('Address'), 'Somewhere 123')
    expect(spy).toHaveBeenLastCalledWith({ address: 'Somewhere 123' })
    spy.mock.calls.forEach(([patch]) => expect(Object.keys(patch)).toEqual(['address']))
    expect(Harness.form.location).toBeUndefined()
    expect(probe.fetchTimezone).not.toHaveBeenCalled()
    expect(screen.getByText('Choose a suggestion to place the pin.')).toBeTruthy()
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(screen.queryByText('Choose a suggestion to place the pin.')).toBeNull()
  })

  it('Enter in the address field never submits a surrounding form', async () => {
    const onSubmit = vi.fn(event => event.preventDefault())
    const user = userEvent.setup()
    render(<form onSubmit={onSubmit}><Harness /></form>)
    await user.type(screen.getByLabelText('Address'), 'x{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('restricts the suggestions to the configured country, as main did, and to none otherwise', () => {
    const { unmount } = render(<Harness />)
    expect(probe.countryCode).toBe('*')
    unmount()
    probe.country = 'mx'
    render(<Harness />)
    expect(probe.countryCode).toBe('mx')
  })

  it('hands the address input to the page through addressInputRef', () => {
    const ref = React.createRef()
    render(<Harness addressInputRef={ref} />)
    expect(ref.current).toBe(screen.getByLabelText('Address'))
  })

  it('dragging the pin holds the point, then its time zone, and offers the address at the pin', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} initial={{ address: '5th Avenue', location: { lat: 40.77, lng: -73.97, zipcode: -1, zoom: 15 } }} />)
    await act(async () => { probe.mapProps.handleChangeCenter(latLng(40.5, -3.6)) })
    await settle()
    expect(spy).toHaveBeenNthCalledWith(1, { location: { lat: 40.5, lng: -3.6, zipcode: -1, zoom: 15 } })
    expect(probe.fetchTimezone).toHaveBeenCalledWith({ lat: 40.5, lng: -3.6 }, 'maps-key')
    expect(spy).toHaveBeenNthCalledWith(2, { timezone: 'Europe/Madrid' })
    const offer = screen.getByRole('status')
    expect(within(offer).getByText('Gran Vía 2, Madrid, Spain')).toBeTruthy()
    expect(offer.textContent).toContain('The pin is at:')
    await user.click(within(offer).getByRole('button', { name: 'Use this address' }))
    expect(spy).toHaveBeenLastCalledWith({
      address: 'Gran Vía 2, Madrid, Spain',
      location: { lat: 40.5, lng: -3.6, zipcode: '28014', zoom: 15 }
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Address').value).toBe('Gran Vía 2, Madrid, Spain')
  })

  it('changing the city and the time zone holds them', async () => {
    const spy = vi.fn()
    const onCityChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} onCityChange={onCityChange} initial={{ timezone: 'America/New_York' }} />)
    await user.selectOptions(screen.getByLabelText('City'), '4')
    expect(onCityChange).toHaveBeenCalledWith(4)
    await user.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Madrid')
    expect(spy).toHaveBeenLastCalledWith({ timezone: 'Europe/Madrid' })
    expect(screen.getByLabelText('Timezone').value).toBe('Europe/Madrid')
  })

  it('shows a placeholder while there is no city, and a loading option while the list loads', () => {
    const { unmount } = render(<Harness cityId={null} />)
    const select = screen.getByLabelText('City')
    expect(select.value).toBe('')
    expect(within(select).getByRole('option', { name: 'Select city' }).disabled).toBe(true)
    unmount()
    render(<Harness citiesLoading />)
    expect(screen.getByLabelText('City').disabled).toBe(true)
    expect(within(screen.getByLabelText('City')).getByRole('option', { name: 'Loading' })).toBeTruthy()
  })

  it('never paints a Google place ID (main dropped the line) nor the Maps key', () => {
    const { container } = render(<Harness initial={{ address: 'Calle Mayor 1', location: { lat: 40.41, lng: -3.70 } }} />)
    expect(screen.queryByText('Google place ID')).toBeNull()
    expect(container.innerHTML).not.toContain('maps-key')
  })

  // the Google search of the page fills the address from outside this group
  it('an address filled from outside redraws the field with it and moves the map to its pin', () => {
    const props = { changeFields: () => {}, cities: CITIES, cityId: 1, onCityChange: () => {}, apiKey: probe.apiKey }
    const { rerender } = render(<StoreAddLocation {...props} form={{ address: 'Calle Mayor 1', location: { lat: 40.41, lng: -3.70 } }} />)
    expect(screen.getByLabelText('Address').value).toBe('Calle Mayor 1')
    const google = { address: '7 Carmine St, New York', location: { lat: 40.73, lng: -74.0, zipcode: '10014', zoom: 15 } }
    rerender(<StoreAddLocation {...props} form={google} />)
    expect(screen.getByLabelText('Address').value).toBe('Calle Mayor 1')
    rerender(<StoreAddLocation {...props} form={google} addressVersion={1} />)
    expect(screen.getByLabelText('Address').value).toBe('7 Carmine St, New York')
    expect(screen.getByTestId('google-map').getAttribute('data-lat')).toBe('40.73')
  })

  it('disables every control while the page says so', () => {
    render(<Harness disabled />)
    expect(screen.getByLabelText('Address').disabled).toBe(true)
    expect(screen.getByLabelText('City').disabled).toBe(true)
    expect(screen.getByLabelText('Timezone').disabled).toBe(true)
  })
})
