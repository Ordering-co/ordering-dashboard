/* eslint-disable import/first */
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign stores 5.8 (2.3): the form of a delivery zone, the body of the SectionSplit detail. No react-hook-form: it
// validates on save (G3-20/G3-29 and the 5.8 decisions), the shape map lives in P/MapFrame (G3-30), the number fields are
// P/NumberField (G3-21), a foreign zone mounts the map as not editable (G3-19) and the form registers its leave guard.
const mocks = vi.hoisted(() => ({
  config: { google_maps_api_key: { value: 'key-1' }, distance_unit: { value: 'km' } },
  sdk: { status: 'ready', generation: 0 },
  useGoogleMapsSdk: null,
  map: vi.fn(),
  useLeaveGuard: vi.fn(),
  registerCloseGuard: vi.fn(() => () => {})
}))
mocks.useGoogleMapsSdk = vi.fn(() => mocks.sdk)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parseNumber: value => value }],
  useConfig: () => [{ configs: mocks.config }],
  ExamineClick: ({ onFiles, childRef, accept }) => <input type='file' data-testid='kml-input' accept={accept} ref={childRef} onChange={event => onFiles(event.target.files)} />,
  BusinessZoneGoogleMaps: props => {
    mocks.map(props)
    return <div data-testid='zone-map' data-type={props.type} data-editable={String(props.disabled)} />
  }
}))
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({ useGoogleMapsSdk: (...args) => mocks.useGoogleMapsSdk(...args) }))
vi.mock('../../../Shared', () => ({
  RecipientSelect: ({ showInherit }) => <div data-testid='recipient' data-inherit={String(!!showInherit)} />
}))
vi.mock('../../../Shared/Product', async (importOriginal) => ({
  ...(await importOriginal()),
  useLeaveGuard: (...args) => mocks.useLeaveGuard(...args),
  useSectionSplit: () => ({ registerCloseGuard: mocks.registerCloseGuard })
}))

import { BusinessDeliveryZoneInformation } from '..'

const polygon = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }]
const polygonZone = { id: 11, name: 'Downtown', type: 2, minimum: 5, price: 3, price_percentage: 0, data: polygon, recipient: 'business' }
const distanceZone = { id: 12, name: 'Near', type: 5, minimum: 5, price: 3, data: { distance: 2, unit: 'km' }, recipient: 'business' }
const foreignZone = { ...polygonZone, id: 13, business_id: 5, businesses: [{ id: 99 }], pivot: { business_id: 99, recipient: null } }
const foreignDistanceZone = { ...distanceZone, id: 14, business_id: 5, businesses: [{ id: 99 }], pivot: { business_id: 99, recipient: null } }

let latest
// The controller keeps `formState`; this harness does the same merges (functional, and `error` cleared on every edit, G3-20).
const Harness = ({ spies, initial, ...props }) => {
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null, ...initial })
  latest = formState
  const handleChangeFormState = changes => setFormState(prev => ({ ...prev, error: null, changes: { ...prev.changes, ...changes } }))
  const handleChangeInput = (event, unit) => (
    event.target.name === 'distance'
      ? handleChangeFormState({ data: { distance: event.target.value, unit } })
      : handleChangeFormState({ [event.target.name]: event.target.value })
  )
  return (
    <BusinessDeliveryZoneInformation
      business={{ id: 5, address: 'Main St 1', location: { lat: 1, lng: 1 } }}
      businessZones={[]}
      formState={formState}
      handleChangeInput={handleChangeInput}
      handleChangeFormState={handleChangeFormState}
      handleDiscardChanges={() => { spies.discard(); setFormState({ loading: false, changes: {}, error: null }) }}
      handleUpdateBusinessDeliveryZone={spies.update}
      handleAddBusinessDeliveryZone={spies.add}
      handleUploadKmlFiles={vi.fn()}
      {...props}
    />
  )
}

const setup = (props = {}, initial) => {
  const spies = { update: vi.fn(async () => ({ ok: true })), add: vi.fn(async () => ({ ok: true })), discard: vi.fn() }
  const user = userEvent.setup()
  render(<Harness spies={spies} initial={initial} {...props} />)
  return { spies, user }
}

// the Product select: open the combobox named `name` and pick the option `option`
const pickOption = async (user, name, option) => {
  await user.click(screen.getByRole('combobox', { name }))
  const box = await screen.findByRole('listbox', { hidden: true })
  await user.click(within(box).getByRole('option', { name: option, hidden: true }))
}
const field = name => screen.getByRole('textbox', { name })
const saveButton = () => screen.getByRole('button', { name: /^(Save|Add)$/ })
const guard = () => mocks.useLeaveGuard.mock.calls.at(-1)[0]

beforeEach(() => {
  mocks.config = { google_maps_api_key: { value: 'key-1' }, distance_unit: { value: 'km' } }
  mocks.sdk = { status: 'ready', generation: 0 }
  mocks.useGoogleMapsSdk.mockClear()
  mocks.map.mockClear()
  mocks.useLeaveGuard.mockClear()
  mocks.registerCloseGuard.mockClear()
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('errors (G3-20, decision Z5)', () => {
  it('shows what the API said once, in an alert notice, and does not bring it back while typing', async () => {
    const { user } = setup({ zone: polygonZone }, { error: ['Name already taken'] })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Name already taken')
    await user.type(field(/Name/), 'x')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.type(field(/Name/), 'y')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('joins a list of messages with spaces', () => {
    setup({ zone: polygonZone }, { error: ['First problem.', 'Second problem.'] })
    expect(screen.getByRole('alert')).toHaveTextContent('First problem. Second problem.')
  })

  it('a new zone without a shape says so in the same notice, and editing removes it', async () => {
    const { spies, user } = setup({}, { changes: { name: 'New', minimum: '1', price: '1' } })
    await user.click(saveButton())
    expect(spies.add).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Add a distance based or draw a polygon or circle.')
    await user.type(field(/Name/), 'x')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('required fields and the range of the distance', () => {
  it('shows each message in its field, focuses the first invalid one and does not call the API', async () => {
    const { spies, user } = setup({ zone: { ...polygonZone, name: '', minimum: '', price: '' } }, { changes: { recipient: 'platform' } })
    await user.click(saveButton())
    expect(spies.update).not.toHaveBeenCalled()
    const name = field(/Name/)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('The name is required.')
    expect(field(/Minimum purchase/)).toHaveAttribute('aria-invalid', 'true')
    expect(field(/Minimum purchase/)).toHaveAccessibleDescription('The minimum purchase is required.')
    expect(field(/Delivery fee/)).toHaveAccessibleDescription('The delivery price is required.')
    await waitFor(() => expect(name).toHaveFocus())
  })

  it('a zero is a value, a blank name is not', async () => {
    const { spies, user } = setup({ zone: { ...polygonZone, name: '   ', minimum: 0, price: 0 } }, { changes: { recipient: 'platform' } })
    await user.click(saveButton())
    expect(spies.update).not.toHaveBeenCalled()
    expect(field(/Name/)).toHaveAttribute('aria-invalid', 'true')
    expect(field(/Minimum purchase/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(field(/Delivery fee/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('a message goes away when its field is edited', async () => {
    const { user } = setup({ zone: { ...polygonZone, name: '' } }, { changes: { recipient: 'platform' } })
    await user.click(saveButton())
    expect(field(/Name/)).toHaveAttribute('aria-invalid', 'true')
    await user.type(field(/Name/), 'N')
    expect(field(/Name/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it.each([['0'], ['100'], ['99.5']])('type 5 refuses a distance of %s', async (value) => {
    const { spies, user } = setup({ zone: distanceZone })
    await user.clear(field(/Distance from store/))
    await user.type(field(/Distance from store/), value)
    await user.click(saveButton())
    expect(spies.update).not.toHaveBeenCalled()
    expect(field(/Distance from store/)).toHaveAccessibleDescription('Enter a distance between 1 and 99.')
  })

  it('type 5 refuses an empty distance and accepts 2.5', async () => {
    const { spies, user } = setup({ zone: distanceZone })
    await user.clear(field(/Distance from store/))
    await user.click(saveButton())
    expect(field(/Distance from store/)).toHaveAccessibleDescription('Enter a distance between 1 and 99.')
    expect(spies.update).not.toHaveBeenCalled()
    await user.type(field(/Distance from store/), '2.5')
    await user.click(saveButton())
    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(latest.changes.data).toEqual({ distance: '2.5', unit: 'km' })
  })

  // review R5.8-05: main's mask did not let the distance go below 1, and the message says «between 1 and 99»
  it('type 5 refuses a distance below 1', async () => {
    const { spies, user } = setup({ zone: distanceZone })
    await user.clear(field(/Distance from store/))
    await user.type(field(/Distance from store/), '0.5')
    await user.click(saveButton())
    expect(field(/Distance from store/)).toHaveAccessibleDescription('Enter a distance between 1 and 99.')
    expect(spies.update).not.toHaveBeenCalled()
  })
})

describe('values sent to the API', () => {
  it('«1.5» in Price percentage is the number 1.5 (G3-21)', async () => {
    const { user } = setup({ zone: polygonZone })
    await user.clear(field(/Price percentage/))
    await user.type(field(/Price percentage/), '1.5')
    expect(latest.changes.price_percentage).toBe(1.5)
    expect(typeof latest.changes.price_percentage).toBe('number')
  })

  it('the minimum purchase and the delivery fee go as text, with decimals', async () => {
    const { user } = setup({ zone: polygonZone })
    await user.clear(field(/Minimum purchase/))
    await user.type(field(/Minimum purchase/), '12.5')
    await user.clear(field(/Delivery fee/))
    await user.type(field(/Delivery fee/), '3.25')
    expect(latest.changes.minimum).toBe('12.5')
    expect(latest.changes.price).toBe('3.25')
  })

  it('the distance goes in data with the unit of the configuration', async () => {
    mocks.config = { ...mocks.config, distance_unit: { value: 'mi' } }
    const { user } = setup({ zone: distanceZone })
    await user.clear(field(/Distance from store/))
    await user.type(field(/Distance from store/), '7')
    expect(latest.changes.data).toEqual({ distance: '7', unit: 'mi' })
    expect(field(/Distance from store/)).toBeInTheDocument()
    expect(screen.getByText(/Distance from store \(mi\)/)).toBeInTheDocument()
  })

  it('changing the type sends the type and clears the shape', async () => {
    const { user } = setup({ zone: polygonZone })
    await user.click(screen.getByRole('combobox', { name: /Type/ }))
    const box = await screen.findByRole('listbox', { hidden: true })
    expect(within(box).getAllByRole('option', { hidden: true }).map(option => option.textContent)).toEqual(['Circle', 'Polygon', 'Everywhere', 'Distance based'])
    await user.click(within(box).getByRole('option', { name: 'Circle', hidden: true }))
    expect(latest.changes.type).toBe(1)
    await waitFor(() => expect(latest.changes.data).toBeNull())
  })

  it('Save runs the update for an existing zone and the add for a new one with a shape', async () => {
    const first = setup({ zone: polygonZone })
    expect(saveButton()).toBeDisabled()
    await first.user.type(field(/Name/), 'x')
    expect(saveButton()).toBeEnabled()
    await first.user.click(saveButton())
    expect(first.spies.update).toHaveBeenCalledTimes(1)
    expect(first.spies.add).not.toHaveBeenCalled()
    cleanup()
    const second = setup({}, { changes: { name: 'New', minimum: '1', price: '1', data: polygon } })
    await second.user.click(saveButton())
    expect(second.spies.add).toHaveBeenCalledTimes(1)
    expect(second.spies.update).not.toHaveBeenCalled()
  })

  it('an Everywhere zone needs no shape', async () => {
    const { spies, user } = setup({}, { changes: { name: 'All', minimum: '1', price: '1', type: 4 } })
    await user.click(saveButton())
    expect(spies.add).toHaveBeenCalledTimes(1)
  })
})

describe('the payload of the Type select (lote C)', () => {
  it('choosing «Everywhere» leaves exactly { type: 4, data: null } (type as a number) in the changes, and Save updates the zone', async () => {
    const { spies, user } = setup({ zone: polygonZone })
    await pickOption(user, /Type/, 'Everywhere')
    expect(screen.getByRole('combobox', { name: /Type/ })).toHaveAccessibleName('Type Everywhere')
    await waitFor(() => expect(latest.changes).toEqual({ type: 4, data: null }))
    await user.click(saveButton())
    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(spies.add).not.toHaveBeenCalled()
  })
})

describe('labels and units (G3-29)', () => {
  it('every field has its label joined to it and no fixed $0.00 or % markers', () => {
    setup({ zone: polygonZone })
    for (const name of [/Name/, /Minimum purchase/, /Delivery fee/, /Price percentage/, /Business address/]) {
      expect(field(name)).toBeInTheDocument()
    }
    expect(screen.getByRole('combobox', { name: /Type/ })).toBeInTheDocument()
    for (const input of screen.getAllByRole('textbox')) {
      expect(input).not.toHaveAttribute('placeholder', '$0.00')
      expect(input).not.toHaveAttribute('placeholder', '%')
    }
  })

  it('the business address is read-only', () => {
    setup({ zone: polygonZone })
    expect(field(/Business address/)).toHaveAttribute('readonly')
    expect(field(/Business address/)).toHaveValue('Main St 1')
  })

  it('type 5 without a configured unit says km, never undefined', async () => {
    mocks.config = { google_maps_api_key: { value: 'key-1' } }
    setup({ zone: distanceZone })
    await screen.findByTestId('zone-map')
    expect(screen.getByText(/Distance from store \(km\)/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('undefined')
    const info = mocks.map.mock.calls.at(-1)[0].infoContentString
    expect(info).toContain('Radius')
    expect(info).toContain('km')
    expect(info).not.toContain('undefined')
    expect(info).not.toContain('Radius:')
  })

  // review R5.8-04: the unit shown is translated, the unit sent is the configured one (as main), never a translation
  it('type 5 without a configured unit sends no translated unit', async () => {
    mocks.config = { google_maps_api_key: { value: 'key-1' } }
    const { user } = setup({ zone: distanceZone })
    await user.clear(field(/Distance from store/))
    await user.type(field(/Distance from store/), '4')
    expect(latest.changes.data).toEqual({ distance: '4', unit: undefined })
  })

  it('the info window of the map uses the configured unit', async () => {
    mocks.config = { ...mocks.config, distance_unit: { value: 'mi' } }
    setup({ zone: distanceZone })
    await screen.findByTestId('zone-map')
    expect(mocks.map.mock.calls.at(-1)[0].infoContentString).toContain('mi')
  })
})

describe('the map (G3-30, G3-19)', () => {
  it('mounts inside the frame with the SDK ready, with Clear shape, and without managedLifecycle', async () => {
    setup({ zone: polygonZone })
    const map = await screen.findByTestId('zone-map')
    const region = screen.getByRole('region', { name: 'Delivery zone map' })
    expect(region).toContainElement(map)
    expect(within(region).getByRole('button', { name: 'Clear shape' })).toBeInTheDocument()
    const props = mocks.map.mock.calls.at(-1)[0]
    expect(props.managedLifecycle).toBeUndefined()
    expect(props.apiKey).toBe('key-1')
    expect(props.isAddMode).toBe(false)
  })

  it('with the SDK in error shows the notice of the frame and not the map', async () => {
    mocks.sdk = { status: 'error', generation: 0 }
    setup({ zone: polygonZone })
    const region = screen.getByRole('region', { name: 'Delivery zone map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(within(region).getByRole('status')).toHaveTextContent('Map unavailable')
    expect(within(region).getByRole('status')).toHaveTextContent('You can still save the other fields. Shapes can be drawn when the map loads.')
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('without an API key the notice says the key is required', () => {
    mocks.config = { distance_unit: { value: 'km' } }
    mocks.sdk = { status: 'error', generation: 0 }
    setup({ zone: polygonZone })
    expect(screen.getByRole('status')).toHaveTextContent('Google Maps api key is required')
    expect(screen.queryByTestId('zone-map')).toBeNull()
  })

  it('asks the SDK loader only when the type draws on a map', () => {
    setup({ zone: { ...polygonZone, type: 4, data: null } })
    expect(mocks.useGoogleMapsSdk).toHaveBeenLastCalledWith(undefined)
    expect(screen.queryByRole('region', { name: 'Delivery zone map' })).toBeNull()
  })

  it('while the SDK loads, neither the map nor Clear shape are mounted', () => {
    mocks.sdk = { status: 'loading', generation: 0 }
    setup({ zone: polygonZone })
    expect(screen.getByRole('region', { name: 'Delivery zone map' })).toHaveAttribute('data-state', 'ready')
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('the map reporting the shape the zone was saved with is not a change; a different shape is', async () => {
    setup({ zone: polygonZone })
    await screen.findByTestId('zone-map')
    const { handleData } = mocks.map.mock.calls.at(-1)[0]
    act(() => { handleData(polygon.map(point => ({ ...point }))) })
    expect(latest.changes).toEqual({})
    expect(guard().dirty).toBe(false)
    expect(saveButton()).toBeDisabled()
    act(() => { handleData([...polygon, { lat: 3, lng: 3 }]) })
    expect(latest.changes.data).toHaveLength(4)
    expect(guard().dirty).toBe(true)
  })

  it('a saved circle reported with the rounding of the map is not a change either', async () => {
    const circleZone = { ...polygonZone, id: 15, type: 1, data: { center: { lat: 1.5, lng: 2.5 }, radio: 1.23 } }
    setup({ zone: circleZone })
    await screen.findByTestId('zone-map')
    act(() => { mocks.map.mock.calls.at(-1)[0].handleData({ center: { lat: 1.5, lng: 2.5 }, radio: 1.2300000000000002 }) })
    expect(latest.changes).toEqual({})
  })

  it('does not draw the map while another tab of the detail is in front, and draws it again when it comes back', async () => {
    const spies = { update: vi.fn(), add: vi.fn(), discard: vi.fn() }
    const view = render(<Harness spies={spies} zone={polygonZone} />)
    await screen.findByTestId('zone-map')
    view.rerender(<Harness spies={spies} zone={polygonZone} active={false} />)
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.getByRole('region', { name: 'Delivery zone map' })).toBeInTheDocument()
    view.rerender(<Harness spies={spies} zone={polygonZone} />)
    expect(screen.getByTestId('zone-map')).toBeInTheDocument()
  })

  it('type 5 shows the map without Clear shape', async () => {
    setup({ zone: distanceZone })
    await screen.findByTestId('zone-map')
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('a zone of mine mounts the map as editable (the `disabled` prop of the map means editable)', async () => {
    setup({ zone: polygonZone })
    await screen.findByTestId('zone-map')
    expect(mocks.map.mock.calls.at(-1)[0].disabled).toBe(true)
  })

  it('a zone of another store mounts the map as not editable and disables its name and type', async () => {
    setup({ zone: foreignZone })
    await screen.findByTestId('zone-map')
    expect(mocks.map.mock.calls.at(-1)[0].disabled).toBe(false)
    expect(screen.getByTestId('zone-map')).toHaveAttribute('data-editable', 'false')
    expect(field(/Name/)).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /Type/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
    expect(screen.getByTestId('recipient')).toHaveAttribute('data-inherit', 'true')
  })

  it('a distance zone of another store disables the distance', () => {
    setup({ zone: foreignDistanceZone })
    expect(field(/Distance from store/)).toBeDisabled()
  })

  it('offers Upload KML for a new polygon or circle only', () => {
    setup({})
    expect(screen.getByRole('button', { name: 'Upload KML' })).toBeInTheDocument()
    cleanup()
    setup({ zone: polygonZone })
    expect(screen.queryByRole('button', { name: 'Upload KML' })).toBeNull()
  })
})

describe('the leave guard (decision 4)', () => {
  it('registers with the close guard of the split, clean at first', () => {
    setup({ zone: polygonZone })
    expect(guard().registerCloseGuard).toBe(mocks.registerCloseGuard)
    expect(guard().dirty).toBe(false)
  })

  it('is dirty with the number of pending keys', async () => {
    const { user } = setup({ zone: polygonZone })
    await user.type(field(/Name/), 'x')
    await user.clear(field(/Minimum purchase/))
    await user.type(field(/Minimum purchase/), '9')
    expect(guard().dirty).toBe(true)
    expect(guard().count).toBe(2)
  })

  it('save validates and answers { ok: false } without calling the API when something is missing', async () => {
    const { spies, user } = setup({ zone: { ...polygonZone, name: '' } }, { changes: { recipient: 'platform' } })
    let result
    await act(async () => { result = await guard().save() })
    expect(result).toEqual({ ok: false })
    expect(spies.update).not.toHaveBeenCalled()
    expect(field(/Name/)).toHaveAttribute('aria-invalid', 'true')
    await user.type(field(/Name/), 'Fixed')
    await act(async () => { result = await guard().save() })
    expect(result).toEqual({ ok: true })
    expect(spies.update).toHaveBeenCalledTimes(1)
  })

  it('save of a new zone adds it and gives back the answer of the add', async () => {
    const { spies } = setup({}, { changes: { name: 'New', minimum: '1', price: '1', data: polygon } })
    spies.add.mockResolvedValueOnce({ ok: false, error: ['Nope'] })
    let result
    await act(async () => { result = await guard().save() })
    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(spies.add).toHaveBeenCalledTimes(1)
  })

  it('save of a new zone without a shape answers { ok: false } and shows the notice', async () => {
    setup({}, { changes: { name: 'New', minimum: '1', price: '1' } })
    let result
    await act(async () => { result = await guard().save() })
    expect(result).toEqual({ ok: false })
    expect(screen.getByRole('alert')).toHaveTextContent('Add a distance based or draw a polygon or circle.')
  })

  it('discard drops the pending changes through the controller', async () => {
    const { spies, user } = setup({ zone: polygonZone })
    await user.type(field(/Name/), 'x')
    expect(guard().dirty).toBe(true)
    await act(async () => { guard().discard() })
    expect(spies.discard).toHaveBeenCalledTimes(1)
    expect(guard().dirty).toBe(false)
    expect(field(/Name/)).toHaveValue('Downtown')
  })
})
