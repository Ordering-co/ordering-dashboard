/* eslint-disable import/first */
import React, { useState } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign DG-B2b (M-DG27 | M-DG39 | decisión 6): the zone form puts its map inside P/MapFrame, mounts it only with the Google SDK
// ready, keeps "Clear shape" inside the ready map, and saves a zone whose shape the user did not touch.
const { state, useGoogleMapsSdk } = vi.hoisted(() => {
  const state = { apiKey: 'key-1', sdk: { status: 'ready', generation: 0 } }
  return { state, useGoogleMapsSdk: vi.fn(() => state.sdk) }
})

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parseNumber: value => value }],
  useConfig: () => [{ configs: { google_maps_api_key: { value: state.apiKey }, distance_unit: { value: 'km' } } }],
  ExamineClick: ({ children }) => <span>{children}</span>,
  BusinessZoneGoogleMaps: props => (
    <div data-testid='zone-map' data-type={props.type} data-clear={String(!!props.clearState)} data-add-mode={String(!!props.isAddMode)} />
  )
}))
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({ useGoogleMapsSdk }))
vi.mock('../../../../styles', () => ({
  Button: ({ borderRadius: _borderRadius, color: _color, ...props }) => <button {...props} />,
  Input: React.forwardRef(function Input (props, ref) { return <input ref={ref} {...props} /> })
}))
vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => (open ? <div role='alert'>{[].concat(content).join(' ')}</div> : null),
  RecipientSelect: () => null
}))

import { DriverGroupDeliveryZoneInformation } from '..'

// the type is the Product select (P/SelectField), the same style as the recipient's, not the legacy FirstSelect
const pickType = (label) => {
  fireEvent.click(screen.getByRole('combobox', { name: /^Type/ }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

const polygon = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }]
const polygonZone = { id: 11, name: 'prishti', type: 2, minimum: 5, price: 3, data: polygon, recipient: 'business' }
const distanceZone = { id: 12, name: 'Caledon 2', type: 5, minimum: 5, price: 3, data: { distance: 2 }, recipient: 'business' }
const everywhereZone = { id: 13, name: 'All', type: 4, minimum: 5, price: 3, data: null, recipient: 'business' }

// The controller keeps `formState`; this harness does the same merge so the form is driven the way the page drives it.
const Harness = ({ spies, ...props }) => {
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const handleChangeFormState = changes => setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } }))
  const handleChangeInput = event => handleChangeFormState({ [event.target.name]: event.target.value })
  return (
    <DriverGroupDeliveryZoneInformation
      formState={formState}
      handleChangeFormState={handleChangeFormState}
      handleChangeInput={handleChangeInput}
      handleUpdateDriverGroupDeliveryZone={spies.update}
      handleAddDriverGroupDeliveryZone={spies.add}
      handleUploadKmlFiles={vi.fn()}
      driverGroupsZones={[]}
      {...props}
    />
  )
}

const setup = (props = {}) => {
  const spies = { update: vi.fn(), add: vi.fn() }
  renderWithProviders(<Harness spies={spies} {...props} />)
  return spies
}

const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^(Save|Add)$/ })) })
}

beforeEach(() => {
  state.apiKey = 'key-1'
  state.sdk = { status: 'ready', generation: 0 }
  useGoogleMapsSdk.mockClear()
})

afterEach(() => { vi.restoreAllMocks() })

describe('zone map in P/MapFrame (M-DG27)', () => {
  it('without an API key shows the MapFrame notice with the key message instead of a bare error, and no Clear', () => {
    state.apiKey = ''
    state.sdk = { status: 'error', generation: 0 }
    setup({ zone: polygonZone })
    const region = screen.getByRole('region', { name: 'Delivery zone map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(within(region).getByRole('status')).toHaveTextContent('Map unavailable')
    expect(within(region).getByRole('status')).toHaveTextContent('Google Maps api key is required')
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('without a key the other fields still save', async () => {
    state.apiKey = ''
    state.sdk = { status: 'error', generation: 0 }
    const spies = setup({ zone: polygonZone })
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
  })

  it('when the SDK fails the notice says the other fields can still be saved, and there is no Clear', () => {
    state.sdk = { status: 'error', generation: 0 }
    setup({ zone: polygonZone })
    const region = screen.getByRole('region', { name: 'Delivery zone map' })
    expect(region).toHaveAttribute('data-state', 'unavailable')
    expect(within(region).getByRole('status')).toHaveTextContent('You can still save the other fields. Shapes can be drawn when the map loads.')
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('while the SDK loads the frame is there but neither the map nor Clear is mounted', () => {
    state.sdk = { status: 'loading', generation: 0 }
    setup({ zone: polygonZone })
    expect(screen.getByRole('region', { name: 'Delivery zone map' })).toHaveAttribute('data-state', 'ready')
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
  })

  it('with the SDK ready mounts the map and Clear shape inside the frame; Clear clears the shape', async () => {
    setup({ zone: polygonZone })
    const map = await screen.findByTestId('zone-map')
    const region = screen.getByRole('region', { name: 'Delivery zone map' })
    expect(region).toContainElement(map)
    const clear = within(region).getByRole('button', { name: 'Clear shape' })
    expect(map).toHaveAttribute('data-clear', 'false')
    fireEvent.click(clear)
    await waitFor(() => expect(screen.getByTestId('zone-map')).toHaveAttribute('data-clear', 'true'))
  })

  it('asks the SDK loader for the map only when the type draws on a map', async () => {
    setup({ zone: everywhereZone })
    expect(screen.queryByRole('region', { name: 'Delivery zone map' })).toBeNull()
    expect(useGoogleMapsSdk).toHaveBeenLastCalledWith(undefined)
  })

  it('the distance and everywhere types have no map and no Clear', () => {
    setup({ zone: distanceZone })
    expect(screen.queryByRole('region', { name: 'Delivery zone map' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
    expect(screen.getByLabelText('Distance from store')).toBeInTheDocument()
  })
})

describe('saving a zone whose shape was not touched (M-DG39)', () => {
  it('changing only the fee of a polygon saves with the shape it already has', async () => {
    const spies = setup({ zone: polygonZone })
    await screen.findByTestId('zone-map')
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('changing only the fee of a polygon also saves without a map', async () => {
    state.apiKey = ''
    state.sdk = { status: 'error', generation: 0 }
    const spies = setup({ zone: polygonZone })
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
  })

  it('changing only the fee of a distance-based zone saves', async () => {
    const spies = setup({ zone: distanceZone })
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an everywhere zone saves without a map (as before)', async () => {
    const spies = setup({ zone: everywhereZone })
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
  })

  it('changing the type without drawing the new shape still warns and does not save', async () => {
    const spies = setup({ zone: polygonZone })
    await screen.findByTestId('zone-map')
    pickType('Circle')
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a distance based or draw a polygon or circle.')
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('clearing the shape of an existing polygon and saving still warns instead of wiping it', async () => {
    const spies = setup({ zone: polygonZone })
    await screen.findByTestId('zone-map')
    fireEvent.click(screen.getByRole('button', { name: 'Clear shape' }))
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a distance based or draw a polygon or circle.')
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('a new zone with no shape still warns and is not added', async () => {
    const spies = setup({ zone: undefined })
    await screen.findByTestId('zone-map')
    fireEvent.change(screen.getByLabelText('Name'), { target: { name: 'name', value: 'North' } })
    fireEvent.change(screen.getByLabelText('Minimum purchase'), { target: { name: 'minimum', value: '1' } })
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '2' } })
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a distance based or draw a polygon or circle.')
    expect(spies.add).not.toHaveBeenCalled()
  })
})

describe('onDirtyChange', () => {
  it('reports whether the form has unsaved changes and clears it on unmount', async () => {
    const onDirtyChange = vi.fn()
    const { unmount } = renderWithProviders(<Harness spies={{ update: vi.fn(), add: vi.fn() }} zone={polygonZone} onDirtyChange={onDirtyChange} />)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    fireEvent.change(screen.getByLabelText('Delivery fee'), { target: { name: 'price', value: '9' } })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('DriverGroupDeliveryZoneInformation type select', () => {
  it('is a Product select named Type that shows the zone type and sends the number', async () => {
    const spies = { update: vi.fn(), add: vi.fn() }
    const formState = { loading: false, changes: {}, error: null }
    const handleChangeFormState = vi.fn()
    renderWithProviders(
      <DriverGroupDeliveryZoneInformation
        zone={polygonZone}
        formState={formState}
        handleChangeFormState={handleChangeFormState}
        handleChangeInput={vi.fn()}
        handleUpdateDriverGroupDeliveryZone={spies.update}
        handleAddDriverGroupDeliveryZone={spies.add}
        handleUploadKmlFiles={vi.fn()}
      />
    )
    const trigger = screen.getByRole('combobox', { name: /^Type/ })
    expect(trigger).toHaveTextContent('Polygon')
    pickType('Everywhere')
    expect(handleChangeFormState).toHaveBeenCalledWith({ type: 4 })
  })
})
