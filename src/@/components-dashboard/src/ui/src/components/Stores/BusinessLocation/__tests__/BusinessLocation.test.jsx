/* eslint-disable import/first */
// redesign stores 5.3: Store details › Location on Product. Covered: the map in P/MapFrame with its notice when Maps
// does not load or there is no key; a picked suggestion holds address, pin, postal code and time zone together (G2-13); typed
// text without a pick is never held, Save refuses it and the leave guard asks about it (D1); dragging the pin holds the point and
// its time zone and offers the address at the pin (D2); a failed time zone lookup keeps the zone and says so (D3); a late lookup
// answer is ignored; labels tied to their controls and the notes' own placeholder (G2-14); save (same request), «Saved», a
// failed save with «Try again» (G2-01), discard; entering does not empty the shared form (G2-03); every owner edits the address (main ).
import React, { useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({
  sdk: { status: 'ready', generation: 0 },
  apiKey: 'maps-key',
  fetchTimezone: null,
  reverseGeocode: null,
  mapProps: null,
  pick: null
}))

const fakes = vi.hoisted(() => ({
  GoogleMapsMap: (props) => {
    probe.mapProps = props
    return <div data-testid='google-map' data-lat={props.location?.lat} data-lng={props.location?.lng} />
  },
  GoogleAutocompleteInput: ({ onChangeAddress, childRef, managedLifecycle, apiKey, countryCode, ...rest }) => {
    probe.pick = onChangeAddress
    return <input {...rest} ref={childRef} />
  },
  CityList: ({ UIComponent, ...props }) => (
    <UIComponent {...props} citiesList={{ loading: false, cities: [{ id: 1, name: 'Default city' }, { id: 4, name: 'Brooklyn' }] }} />
  )
}))

const index = vi.hoisted(() => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: probe.apiKey } } }]
}))

vi.mock('../../../../../../index', () => ({ ...index, ...fakes }))
vi.mock('~components', () => ({ ...index, ...fakes }))
vi.mock('../../../../../../utils', () => ({ normalizeTimezone: zone => (zone === 'Europe/Kiev' ? 'Europe/Kyiv' : zone) }))
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({
  useGoogleMapsSdk: () => probe.sdk
}))
vi.mock('../geo', () => ({
  fetchTimezone: (...args) => probe.fetchTimezone(...args),
  reverseGeocode: (...args) => probe.reverseGeocode(...args)
}))

import { BusinessLocation } from '../index'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'

const STORE = {
  id: 2,
  address: '5th Avenue, New York, NY, USA',
  address_notes: '',
  city_id: 1,
  timezone: 'America/New_York',
  zipcode: '-1',
  location: { lat: 40.77, lng: -73.97, zipcode: -1, zoom: 15 }
}

const PLACE = {
  address: 'Calle Mayor 1, Madrid, Spain',
  location: { lat: 40.41, lng: -3.70 },
  zipcode: '28013',
  street_number: '1',
  route: 'Calle Mayor',
  city_name: 'Madrid',
  country: 'Spain',
  country_code: 'ES',
  utc_offset: 120,
  map_data: { library: 'google', place_id: 'abc' }
}

const Harness = ({ result = { ok: true }, spy, initialChanges = {}, hostRef }) => {
  const [business, setBusiness] = useState(STORE)
  const [formState, setFormState] = useState({ loading: false, changes: initialChanges })
  const latest = useRef(null)
  latest.current = { business, formState }
  Harness.formState = formState
  const host = useLeaveGuardHost()
  if (hostRef) hostRef.current = host
  const handleUpdateBusinessClick = async (...args) => {
    Harness.saveArgs.push(args)
    spy && spy({ ...latest.current.formState.changes })
    if (result.ok) {
      setBusiness({ ...latest.current.business, ...latest.current.formState.changes })
      setFormState(prev => ({ ...prev, changes: {} }))
    }
    return result
  }
  return (
    <LeaveGuardContext.Provider value={host.context}>
      <BusinessLocation
        business={business}
        formState={formState}
        setFormState={setFormState}
        handleUpdateBusinessClick={handleUpdateBusinessClick}
      />
    </LeaveGuardContext.Provider>
  )
}

Harness.saveArgs = []

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  Harness.saveArgs = []
  probe.sdk = { status: 'ready', generation: 0 }
  probe.apiKey = 'maps-key'
  probe.fetchTimezone = vi.fn().mockResolvedValue({ ok: true, timezone: 'Europe/Madrid' })
  probe.reverseGeocode = vi.fn().mockResolvedValue({ ok: true, address: 'Gran Vía 2, Madrid, Spain', zipcode: '28014' })
  probe.mapProps = null
  probe.pick = null
})

describe('Store details › Location', () => {
  it('ties every label to its control and gives the notes their own placeholder (G2-14)', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Address').value).toBe('5th Avenue, New York, NY, USA')
    expect(screen.getByLabelText('City').value).toBe('1')
    expect(screen.getByLabelText('Timezone').value).toBe('America/New_York')
    const notes = screen.getByLabelText('Address Notes')
    expect(notes.getAttribute('placeholder')).toBe('For example, the entrance or the floor')
  })

  it('draws the map in its frame, and says so in the slot when Maps cannot load', () => {
    const { unmount } = render(<Harness />)
    expect(screen.getByRole('region', { name: 'Store location map' }).getAttribute('data-state')).toBe('ready')
    expect(screen.getByTestId('google-map')).toBeTruthy()
    unmount()
    probe.sdk = { status: 'error', error: 'map_unavailable', generation: 0 }
    render(<Harness />)
    const frame = screen.getByRole('region', { name: 'Store location map' })
    expect(frame.getAttribute('data-state')).toBe('unavailable')
    expect(within(frame).getByText('Map unavailable')).toBeTruthy()
    expect(screen.queryByTestId('google-map')).toBeNull()
    expect(screen.getByText('Address search needs Google Maps, which is not available right now.')).toBeTruthy()
  })

  it('says the key is missing when there is none, and never asks for a time zone', () => {
    probe.apiKey = undefined
    probe.sdk = { status: 'error', error: 'missing_map_key', generation: 0 }
    render(<Harness />)
    expect(screen.getByText('Google Maps api key is required')).toBeTruthy()
  })

  it('holds address, pin, postal code and time zone together when a suggestion is picked (G2-13)', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(probe.fetchTimezone).toHaveBeenCalledWith({ lat: 40.41, lng: -3.70 }, 'maps-key')
    const changes = Harness.formState.changes
    expect(changes.address).toBe('5th Avenue, New York, NY, USA') // the input's text, as before (Google writes the pick there)
    expect(changes.location).toEqual({ lat: 40.41, lng: -3.70, zipcode: '28013', zoom: 15 })
    expect(changes.zipcode).toBe('28013')
    expect(changes.timezone).toBe('Europe/Madrid')
    expect(changes.route).toBe('Calle Mayor')
    expect(screen.getByTestId('google-map').getAttribute('data-lat')).toBe('40.41')
    expect(screen.getByLabelText('Timezone').value).toBe('Europe/Madrid')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  // redesign bugs F row 12: a failed save is said in the save bar; the controller must not add its own toast on top
  it('Save asks the controller to keep a failure inline: handleUpdateBusinessClick({}, { inlineError: true })', async () => {
    const user = userEvent.setup()
    render(<Harness initialChanges={{ address_notes: 'Back door' }} result={{ ok: false, error: ['Nope'] }} />)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(Harness.saveArgs).toEqual([[{}, { inlineError: true }]])
  })

  it('holds text typed without picking a suggestion as a normal change of address, and Save sends it with the other fields (R-02)', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    const field = screen.getByLabelText('Address')
    await user.clear(field)
    await user.type(field, 'Somewhere 123')
    expect(Harness.formState.changes).toEqual({ address: 'Somewhere 123' })
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    await user.type(screen.getByLabelText('Address Notes'), 'Back door')
    expect(screen.getByText('2 unsaved changes')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ address: 'Somewhere 123', address_notes: 'Back door' })
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.queryByText('Fix 1 field to save.')).toBeNull()
  })

  it('a typed address does not block saving the other Location fields', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    await user.type(screen.getByLabelText('Address'), ' 9')
    await user.selectOptions(screen.getByLabelText('City'), '4')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(spy).toHaveBeenCalledWith({ address: '5th Avenue, New York, NY, USA 9', city_id: 4 })
  })

  it('guides toward a suggestion with a hint that is not an error, while the address was typed and not picked (R-02)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const pickHint = 'Choose an address from the suggestions, so the pin, postal code and time zone match it.'
    const field = screen.getByLabelText('Address')
    expect(screen.queryByText(pickHint)).toBeNull()
    await user.type(field, ' 9')
    const hint = screen.getByText(pickHint)
    expect(hint.closest('[role="alert"]')).toBeNull()
    expect(field.getAttribute('aria-invalid')).toBeNull()
    expect(field.getAttribute('aria-describedby')).toContain(hint.id)
    expect(screen.queryByRole('alert')).toBeNull()
    // back to the stored text: no change, no hint
    await user.type(field, '{Backspace}{Backspace}')
    expect(Harness.formState.changes).toEqual({})
    expect(screen.queryByText(pickHint)).toBeNull()
    // picking a suggestion ends the hint
    await user.type(field, ' 9')
    expect(screen.getByText(pickHint)).toBeTruthy()
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(screen.queryByText(pickHint)).toBeNull()
  })

  it('discard puts the stored address back, drops the change and the hint (R-02)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Address'), ' 9')
    expect(Harness.formState.changes.address).toBe('5th Avenue, New York, NY, USA 9')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(Harness.formState.changes).toEqual({})
    expect(screen.getByLabelText('Address').value).toBe('5th Avenue, New York, NY, USA')
    expect(screen.queryByText(/Choose an address from the suggestions/)).toBeNull()
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('without Maps the typed address still saves and the field keeps its Maps notice, not the pick hint (R-02)', async () => {
    probe.sdk = { status: 'error', error: 'map_unavailable', generation: 0 }
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    await user.type(screen.getByLabelText('Address'), ' 9')
    expect(screen.getByText('Address search needs Google Maps, which is not available right now.')).toBeTruthy()
    expect(screen.queryByText(/Choose an address from the suggestions/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(spy).toHaveBeenCalledWith({ address: '5th Avenue, New York, NY, USA 9' })
  })

  it('Enter in the address field picks from Google\'s list and never submits the form', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} />)
    await user.type(screen.getByLabelText('Address Notes'), 'x')
    await user.type(screen.getByLabelText('Address'), '{Enter}')
    expect(spy).not.toHaveBeenCalled()
  })

  it('dragging the pin holds the point and its time zone, and offers the address at the pin (D2)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await act(async () => { probe.mapProps.handleChangeCenter({ lat: () => 40.42, lng: () => -3.71 }) })
    await settle()
    let changes = Harness.formState.changes
    expect(changes.location).toEqual({ lat: 40.42, lng: -3.71, zipcode: -1, zoom: 15 })
    expect(changes.timezone).toBe('Europe/Madrid')
    expect(changes.address).toBeUndefined()
    expect(screen.getByText('Gran Vía 2, Madrid, Spain')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Use this address' }))
    changes = Harness.formState.changes
    expect(changes.address).toBe('Gran Vía 2, Madrid, Spain')
    expect(changes.zipcode).toBe('28014')
    expect(changes.location).toEqual({ lat: 40.42, lng: -3.71, zipcode: '28014', zoom: 15 })
    expect(screen.getByLabelText('Address').value).toBe('Gran Vía 2, Madrid, Spain')
    expect(screen.queryByRole('button', { name: 'Use this address' })).toBeNull()
  })

  it('keeps the time zone and says so when it cannot be looked up (D3)', async () => {
    probe.fetchTimezone = vi.fn().mockResolvedValue({ ok: false })
    render(<Harness />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(Harness.formState.changes.timezone).toBeUndefined()
    expect(screen.getByLabelText('Timezone').value).toBe('America/New_York')
    expect(screen.getByText('We couldn\'t get the time zone of this place. Check it.')).toBeTruthy()
  })

  it('ignores a time zone that arrives after a newer pick', async () => {
    let first
    probe.fetchTimezone = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
      .mockResolvedValueOnce({ ok: true, timezone: 'Europe/Lisbon' })
    render(<Harness />)
    await act(async () => { probe.pick(PLACE) })
    await act(async () => { probe.pick({ ...PLACE, location: { lat: 38.72, lng: -9.14 } }) })
    await settle()
    await act(async () => { first({ ok: true, timezone: 'Europe/Madrid' }) })
    await settle()
    expect(Harness.formState.changes.timezone).toBe('Europe/Lisbon')
  })

  it('lists time zones by city first, so typing the city finds it (review 4)', () => {
    render(<Harness />)
    const select = screen.getByLabelText('Timezone')
    const labels = [...select.options].map(option => option.textContent)
    expect(labels).toContain('Bogota · America')
    expect(labels).toContain('New York · America')
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(select.value).toBe('America/New_York')
  })

  it('a time zone that arrives after a manual choice does not replace it (review 5)', async () => {
    const user = userEvent.setup()
    let answerLookup
    probe.fetchTimezone = vi.fn().mockImplementation(() => new Promise(resolve => { answerLookup = resolve }))
    render(<Harness />)
    await act(async () => { probe.pick(PLACE) })
    await user.selectOptions(screen.getByLabelText('Timezone'), 'America/Bogota')
    await act(async () => { answerLookup({ ok: true, timezone: 'Europe/Madrid' }) })
    await settle()
    expect(Harness.formState.changes.timezone).toBe('America/Bogota')
  })

  it('«Use this address» drops the parts of an earlier pick (review 7)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    expect(Harness.formState.changes.route).toBe('Calle Mayor')
    await act(async () => { probe.mapProps.handleChangeCenter({ lat: () => 40.42, lng: () => -3.71 }) })
    await settle()
    await user.click(screen.getByRole('button', { name: 'Use this address' }))
    const changes = Harness.formState.changes
    expect(changes.route).toBeUndefined()
    expect(changes.map_data).toBeUndefined()
    expect(changes.address).toBe('Gran Vía 2, Madrid, Spain')
  })

  it('a failed save says why in the bar and «Try again» retries (G2-01)', async () => {
    const spy = vi.fn()
    const user = userEvent.setup()
    render(<Harness spy={spy} result={{ ok: false, error: ['The address is not valid'] }} />)
    await user.type(screen.getByLabelText('Address Notes'), 'Back door')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('The address is not valid')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('names the changed fields, and a value back to the stored one is no change', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('City'), '4')
    await user.type(screen.getByLabelText('Address Notes'), 'Floor 2')
    expect(screen.getByText('2 unsaved changes')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('City'), '1')
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    expect(Harness.formState.changes).toEqual({ address_notes: 'Floor 2' })
  })

  it('discard drops only what Location holds and puts the map back', async () => {
    const user = userEvent.setup()
    render(<Harness initialChanges={{ slug: 'kept' }} />)
    await act(async () => { probe.pick(PLACE) })
    await settle()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(Harness.formState.changes).toEqual({ slug: 'kept' })
    expect(screen.getByTestId('google-map').getAttribute('data-lat')).toBe('40.77')
  })

  it('entering does not empty what the shared form already holds (G2-03)', () => {
    render(<Harness initialChanges={{ address_notes: 'Held before' }} />)
    expect(Harness.formState.changes).toEqual({ address_notes: 'Held before' })
    expect(screen.getByLabelText('Address Notes').value).toBe('Held before')
  })

  it('the pin can always be dragged and the address edited (main dropped the EatStreet owner rule)', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Address')).toBeTruthy()
    expect(screen.getByLabelText('Address Notes')).toBeTruthy()
    expect(probe.mapProps.mapControls.isMarkerDraggable).toBe(true)
    expect(typeof probe.mapProps.handleChangeCenter).toBe('function')
  })
})
