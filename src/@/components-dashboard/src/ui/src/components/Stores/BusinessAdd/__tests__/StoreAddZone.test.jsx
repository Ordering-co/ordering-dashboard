/* eslint-disable import/first */
import React, { useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign stores add (2.3-B): the delivery zone of the new-store form. Presentational: the page keeps the zone, this piece
// draws it. It keeps what main did (a zone starts as a polygon, a change of type empties the shape, the shape of the map goes to
// `data` as the map reports it, a distance is `{ distance, unit }`) and closes G5-28 (the old card header was a div with onClick).
const mocks = vi.hoisted(() => ({
  sdk: { status: 'ready', generation: 0 },
  useGoogleMapsSdk: null,
  map: vi.fn()
}))
mocks.useGoogleMapsSdk = vi.fn(() => mocks.sdk)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  BusinessZoneGoogleMaps: props => {
    mocks.map(props)
    return <div data-testid='zone-map' data-type={props.type} data-editable={String(props.disabled)} />
  }
}))
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({ useGoogleMapsSdk: (...args) => mocks.useGoogleMapsSdk(...args) }))

import { StoreAddZone } from '../StoreAddZone'

const polygon = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }]
const circle = { center: { lat: 1, lng: 1 }, radio: 3 }
const polygonZone = { name: 'Downtown', type: 2, minimum: '5', price: '3', data: polygon }

let latest
let changes
// The page keeps the zone; this harness does the same (it takes a value or an updater, as the page does).
const Harness = ({ initial = null, ...props }) => {
  const [zone, setZone] = useState(initial)
  latest = zone
  return (
    <StoreAddZone
      zone={zone}
      onZoneChange={next => {
        changes.push(next)
        setZone(next)
      }}
      deliveryAllowed
      apiKey='key-1'
      location={{ lat: 4, lng: 4 }}
      currency='$'
      distanceUnit='km'
      {...props}
    />
  )
}

const setup = (props = {}) => {
  const user = userEvent.setup()
  const view = render(<Harness {...props} />)
  return { user, ...view }
}

const field = name => screen.getByRole('textbox', { name })
const lastMapProps = () => mocks.map.mock.calls.at(-1)[0]

beforeEach(() => {
  mocks.sdk = { status: 'ready', generation: 0 }
  mocks.useGoogleMapsSdk.mockClear()
  mocks.map.mockClear()
  changes = []
  latest = undefined
})

afterEach(cleanup)

describe('without delivery', () => {
  it('says the delivery order type is disabled and shows nothing to fill', () => {
    const { container } = setup({ deliveryAllowed: false })
    expect(screen.getByText('The delivery order type is disabled for your project. Enable it in Settings to create delivery zones.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(container.querySelector('.odc-sadd-zone')).not.toBeNull()
    expect(mocks.useGoogleMapsSdk).toHaveBeenCalledWith(undefined)
  })
})

describe('no zone yet', () => {
  it('offers a real button that starts the zone as main did: a polygon, empty', async () => {
    const { user } = setup()
    expect(screen.getByText('Delivery zone')).toBeInTheDocument()
    expect(screen.getByText('Optional. You can add more later.')).toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Add a delivery zone' })
    expect(add.tagName).toBe('BUTTON')
    expect(add).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(add)
    expect(changes).toEqual([{ name: '', type: 2, minimum: '', price: '', data: null }])
    expect(latest).toEqual({ name: '', type: 2, minimum: '', price: '', data: null })
    expect(field(/Name/)).toBeInTheDocument()
  })

  it('a disabled form does not start a zone', async () => {
    const { user } = setup({ disabled: true })
    const add = screen.getByRole('button', { name: 'Add a delivery zone' })
    expect(add).toBeDisabled()
    await user.click(add)
    expect(changes).toEqual([])
  })
})

describe('the zone', () => {
  it('draws name, the four types in order, minimum and fee, with the currency in the hint and no fixed placeholder', () => {
    setup({ initial: polygonZone })
    expect(field(/Name/)).toHaveValue('Downtown')
    const types = ['Circle', 'Polygon', 'Everywhere', 'Distance based'].map(name => screen.getByRole('button', { name }))
    expect(types[1]).toHaveAttribute('aria-pressed', 'true')
    expect(types[0]).toHaveAttribute('aria-pressed', 'false')
    expect(types[0].compareDocumentPosition(types[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(types[2].compareDocumentPosition(types[3]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(field(/Minimum purchase/)).toHaveValue('5')
    expect(field(/Delivery fee/)).toHaveValue('3')
    expect(field(/Minimum purchase/)).toHaveAccessibleDescription('Amount in $')
    expect(field(/Delivery fee/)).not.toHaveAttribute('placeholder', '$0.00')
  })

  it('has no currency hint when there is no currency', () => {
    setup({ initial: polygonZone, currency: '' })
    expect(field(/Minimum purchase/)).not.toHaveAccessibleDescription(/Amount in/)
  })

  it('typing goes to the zone as the text main kept', async () => {
    const { user } = setup({ initial: { ...polygonZone, name: '', minimum: '', price: '' } })
    await user.type(field(/Name/), 'Zone')
    await user.type(field(/Minimum purchase/), '12.5')
    await user.type(field(/Delivery fee/), '3')
    expect(latest).toMatchObject({ name: 'Zone', minimum: '12.5', price: '3', type: 2, data: polygon })
  })

  it('changing the type empties the shape, as main did, and keeps the rest', async () => {
    const { user } = setup({ initial: { ...polygonZone, data: circle, type: 1 } })
    await user.click(screen.getByRole('button', { name: 'Polygon' }))
    expect(latest).toEqual({ name: 'Downtown', type: 2, minimum: '5', price: '3', data: null })
    await user.click(screen.getByRole('button', { name: 'Everywhere' }))
    expect(latest).toMatchObject({ type: 4, data: null })
  })

  it('Remove zone gives the zone back as null', async () => {
    const { user } = setup({ initial: polygonZone })
    await user.click(screen.getByRole('button', { name: 'Remove zone' }))
    expect(changes.at(-1)).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a delivery zone' })).toBeInTheDocument()
  })

  it('a disabled form disables every control', () => {
    setup({ initial: polygonZone, disabled: true })
    expect(field(/Name/)).toBeDisabled()
    expect(field(/Minimum purchase/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove zone' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Circle' })).toBeDisabled()
  })
})

describe('distance based', () => {
  it('asks the distance with the unit and keeps it as { distance, unit }, like main', async () => {
    const { user } = setup({ initial: { ...polygonZone, type: 5, data: null }, distanceUnit: 'mi' })
    const distance = field(/Distance from store \(mi\)/)
    await user.type(distance, '7')
    expect(latest.data).toEqual({ distance: '7', unit: 'mi' })
    expect(distance).toHaveValue('7')
  })

  it('draws the radius on the map without a way to clear it, and Everywhere draws no map', async () => {
    const { user } = setup({ initial: { ...polygonZone, type: 5, data: { distance: '4', unit: 'km' } } })
    expect(screen.getByTestId('zone-map')).toHaveAttribute('data-type', '5')
    expect(lastMapProps().distance).toBe('4')
    expect(screen.queryByRole('button', { name: 'Clear shape' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Everywhere' }))
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(field(/Name/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Distance from store/ })).toBeNull()
  })

  it('shows the distance range error only when asked to', () => {
    const problems = { zoneDistance: 'invalid' }
    const { rerender } = render(<StoreAddZone zone={{ ...polygonZone, type: 5, data: { distance: '120', unit: 'km' } }} onZoneChange={() => {}} deliveryAllowed apiKey='k' distanceUnit='km' problems={problems} showErrors={false} />)
    expect(screen.queryByText('Enter a distance from 1 to 99')).toBeNull()
    rerender(<StoreAddZone zone={{ ...polygonZone, type: 5, data: { distance: '120', unit: 'km' } }} onZoneChange={() => {}} deliveryAllowed apiKey='k' distanceUnit='km' problems={problems} showErrors />)
    expect(screen.getByText('Enter a distance from 1 to 99')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Distance from store/ })).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('the map', () => {
  it('draws a circle or a polygon map around the pin of the store and sends the shape to data as the map reports it', async () => {
    setup({ initial: { ...polygonZone, type: 1, data: null } })
    expect(mocks.useGoogleMapsSdk).toHaveBeenCalledWith('key-1')
    const props = lastMapProps()
    expect(props.type).toBe(1)
    expect(props.location).toEqual({ lat: 4, lng: 4 })
    expect(props.apiKey).toBe('key-1')
    // in BusinessZoneGoogleMaps `disabled` means editable
    expect(props.disabled).toBe(true)
    act(() => props.handleData(circle))
    expect(latest.data).toEqual(circle)
    expect(lastMapProps().data).toEqual(circle)
    act(() => lastMapProps().handleData(null))
    expect(latest.data).toBeNull()
  })

  it('Clear shape empties the shape and asks the map to clear itself', async () => {
    const { user } = setup({ initial: { ...polygonZone, data: polygon } })
    await user.click(screen.getByRole('button', { name: 'Clear shape' }))
    expect(latest.data).toBeNull()
    expect(lastMapProps().clearState).toBe(true)
    act(() => lastMapProps().setClearState(false))
    expect(lastMapProps().clearState).toBe(false)
  })

  it('moving the pin of the store empties the shape, but not on the first draw', () => {
    const { rerender } = render(<StoreAddZone zone={polygonZone} onZoneChange={vi.fn()} deliveryAllowed apiKey='k' location={{ lat: 1, lng: 1 }} />)
    const onZoneChange = vi.fn()
    rerender(<StoreAddZone zone={polygonZone} onZoneChange={onZoneChange} deliveryAllowed apiKey='k' location={{ lat: 1, lng: 1 }} />)
    expect(onZoneChange).not.toHaveBeenCalled()
    rerender(<StoreAddZone zone={polygonZone} onZoneChange={onZoneChange} deliveryAllowed apiKey='k' location={{ lat: 9, lng: 9 }} />)
    expect(onZoneChange).toHaveBeenCalledTimes(1)
    const next = onZoneChange.mock.calls[0][0]
    expect(typeof next === 'function' ? next(polygonZone) : next).toEqual({ ...polygonZone, data: null })
  })

  it('without a key the frame says why, and does not load the SDK', () => {
    setup({ initial: polygonZone, apiKey: undefined })
    expect(mocks.useGoogleMapsSdk).toHaveBeenCalledWith(undefined)
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.getByText('Google Maps api key is required')).toBeInTheDocument()
  })

  it('a map that failed to load says so', () => {
    mocks.sdk = { status: 'error', generation: 0 }
    setup({ initial: polygonZone })
    expect(screen.queryByTestId('zone-map')).toBeNull()
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
  })
})

describe('errors', () => {
  const problems = {
    zoneName: 'required',
    zoneMinimum: 'required',
    zonePrice: 'invalid',
    zoneGeometry: 'required'
  }
  const empty = { name: '', type: 2, minimum: '', price: '-1', data: null }

  it('paints nothing before the page asks for it', () => {
    setup({ initial: empty, problems, showErrors: false })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(field(/Name/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('paints each message in its own field when asked, and the missing shape under the map', () => {
    setup({ initial: empty, problems, showErrors: true })
    expect(field(/Name/)).toHaveAccessibleDescription('Enter a name')
    expect(field(/Name/)).toHaveAttribute('aria-invalid', 'true')
    expect(field(/Minimum purchase/)).toHaveAccessibleDescription(/Enter an amount of 0 or more/)
    expect(field(/Delivery fee/)).toHaveAccessibleDescription(/Enter an amount of 0 or more/)
    expect(screen.getByText('Draw the delivery area on the map')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(4)
  })

  it('a zero is an amount: no error on a minimum of 0 and a fee of 0', () => {
    setup({ initial: { ...polygonZone, minimum: '0', price: '0' }, problems: {}, showErrors: true })
    expect(field(/Minimum purchase/)).toHaveValue('0')
    expect(field(/Delivery fee/)).toHaveValue('0')
    expect(field(/Minimum purchase/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(field(/Delivery fee/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows no shape error for Everywhere', () => {
    setup({ initial: { ...polygonZone, type: 4, data: null }, problems: {}, showErrors: true })
    expect(screen.queryByText('Draw the delivery area on the map')).toBeNull()
  })
})
