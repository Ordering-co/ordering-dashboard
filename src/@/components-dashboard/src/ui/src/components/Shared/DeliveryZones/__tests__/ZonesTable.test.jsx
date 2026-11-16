/* eslint-disable import/first */
// redesign stores 5.8: the zones table shared by GroupZones and the store. Presentation only, so it is drawn with plain
// props. The language, utils and phone flag are simulated as in GroupZones.test; DataTable, RecordCardList, Checkbox and Switch are the real ones.
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ parsePrice: value => `$ ${Number(value).toFixed(2)}` }]
}))
vi.mock('../../Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { ZonesTable } from '../ZonesTable'

const ZONES = () => ([
  { id: 11, name: 'Centre', type: 1, enabled: true, minimum: 10, price: 2.5, data: { center: { lat: 41, lng: -73 }, radio: 2 } },
  { id: 12, name: 'Ring', type: 2, enabled: false, minimum: 0, price: 5, data: [] }
])

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

let handlers
const draw = (props = {}) => {
  handlers = { onToggle: vi.fn(), onToggleAll: vi.fn(), onOpen: vi.fn() }
  const zones = ZONES()
  return render(
    <ZonesTable
      zones={zones}
      isActive={zone => Boolean(zone.enabled)}
      allChecked={false}
      label='Delivery zones'
      loadingLabel='Loading delivery zones'
      {...handlers}
      {...props}
    />
  )
}
const rowOf = (id) => document.querySelector(`tr[data-row-id="${id}"]`)
const cardOf = (id) => document.querySelector(`li[data-row-id="${id}"]`)

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ZonesTable · the table (default: checkbox)', () => {
  it('draws one row per zone, with the columns, the name button and the figures', () => {
    draw()
    const table = screen.getByRole('table', { name: 'Delivery zones' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(rowOf(11)).toBeTruthy()
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).toHaveAttribute('data-gz-open', '11')
    expect(within(rowOf(11)).getByText('$ 10.00')).toBeInTheDocument()
    expect(within(rowOf(11)).getByText('$ 2.50')).toBeInTheDocument()
  })

  it('names each Active as a checkbox «Active: <name>» that reports the next value, and Select all in the header', async () => {
    const user = userEvent.setup()
    draw()
    const box = within(rowOf(12)).getByRole('checkbox', { name: 'Active: Ring' })
    expect(box).not.toBeChecked()
    expect(within(rowOf(11)).getByRole('checkbox', { name: 'Active: Centre' })).toBeChecked()
    expect(within(rowOf(12)).queryByRole('switch')).toBeNull()
    await user.click(box)
    expect(handlers.onToggle).toHaveBeenCalledTimes(1)
    expect(handlers.onToggle.mock.calls[0][0].id).toBe(12)
    expect(handlers.onToggle.mock.calls[0][1]).toBe(true)
    expect(handlers.onOpen).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(handlers.onToggleAll).toHaveBeenCalledWith(true)
  })

  // redesign bugs F row 31: the table header had a two-state Select all while the cards had three
  it('draws Select all in the header as mixed when only some zones are active, checked when all are, unchecked when none', () => {
    const zones = [...ZONES(), { id: 13, name: 'Outer', type: 2, enabled: true, minimum: 0, price: 1, data: [] }]
    draw({ zones })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
    cleanup()
    draw({ zones: zones.map(zone => ({ ...zone, enabled: true })), allChecked: true })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    cleanup()
    draw({ zones: zones.map(zone => ({ ...zone, enabled: false })) })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a click on a mixed Select all in the header turns every zone on', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(handlers.onToggleAll).toHaveBeenCalledWith(true)
  })

  it('disables the controls with actionDisabled and Select all while it loads', () => {
    draw({ actionDisabled: true })
    expect(within(rowOf(11)).getByRole('checkbox', { name: 'Active: Centre' })).toBeDisabled()
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeDisabled()
    cleanup()
    draw({ loading: true, zones: [] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeDisabled()
  })

  it('opens the zone with a click on the row and with Enter on the focused row', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(within(rowOf(11)).getByText('$ 10.00'))
    expect(handlers.onOpen).toHaveBeenCalledTimes(1)
    expect(handlers.onOpen.mock.calls[0][0].id).toBe(11)
    act(() => rowOf(12).focus())
    await user.keyboard('{Enter}')
    expect(handlers.onOpen).toHaveBeenCalledTimes(2)
    expect(handlers.onOpen.mock.calls[1][0].id).toBe(12)
  })

  it('opens the zone with its name button', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(within(rowOf(12)).getByRole('button', { name: 'Ring' }))
    expect(handlers.onOpen.mock.calls.at(-1)[0].id).toBe(12)
  })

  it('highlights the selected row and gives its name button no aria-current without currentId', () => {
    draw({ selectedId: '12' })
    expect(rowOf(12)).toHaveAttribute('data-active')
    expect(rowOf(11)).not.toHaveAttribute('data-active')
    expect(rowOf(12)).toHaveAttribute('aria-current', 'true') // the row, as DataTable marks it
    expect(document.querySelector('button[aria-current]')).toBeNull() // no name button without currentId
  })
})

describe('ZonesTable · opt-ins', () => {
  it('activeControl="switch" draws a switch «Active: <name>» per row, reports the next value and does not open the row', async () => {
    const user = userEvent.setup()
    draw({ activeControl: 'switch' })
    const off = within(rowOf(12)).getByRole('switch', { name: 'Active: Ring' })
    expect(off).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(11)).getByRole('switch', { name: 'Active: Centre' })).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(12)).queryByRole('checkbox')).toBeNull()
    await user.click(off)
    expect(handlers.onToggle).toHaveBeenCalledTimes(1)
    expect(handlers.onToggle.mock.calls[0][0].id).toBe(12)
    expect(handlers.onToggle.mock.calls[0][1]).toBe(true)
    expect(handlers.onOpen).not.toHaveBeenCalled()
    await user.click(within(rowOf(11)).getByRole('switch', { name: 'Active: Centre' }))
    expect(handlers.onToggle.mock.calls[1][1]).toBe(false)
    expect(handlers.onOpen).not.toHaveBeenCalled()
  })

  it('with switches, Select all in the header is still a checkbox', async () => {
    const user = userEvent.setup()
    // redesign bugs F row 31: the header now reads the zones (as the cards do), so «all checked» needs every zone active
    draw({ activeControl: 'switch', allChecked: true, zones: ZONES().map(zone => ({ ...zone, enabled: true })) })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toBeChecked()
    await user.click(all)
    expect(handlers.onToggleAll).toHaveBeenCalledWith(false)
  })

  it('getRowAttributes adds its data-* attributes and class to the row of each zone', () => {
    draw({ getRowAttributes: zone => ({ 'data-zone-kind': zone.type === 1 ? 'radius' : 'polygon', className: zone.id === 12 ? 'tinted' : undefined }) })
    expect(rowOf(11)).toHaveAttribute('data-zone-kind', 'radius')
    expect(rowOf(12)).toHaveAttribute('data-zone-kind', 'polygon')
    expect(rowOf(12)).toHaveClass('tinted')
    expect(rowOf(11)).not.toHaveClass('tinted')
  })

  it('currentId marks the name button of the open zone with aria-current', () => {
    draw({ currentId: '12' })
    expect(within(rowOf(12)).getByRole('button', { name: 'Ring' })).toHaveAttribute('aria-current', 'true')
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).not.toHaveAttribute('aria-current')
  })
})

describe('ZonesTable · on a phone', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards with a checkbox Active and a Select all row', async () => {
    const user = userEvent.setup()
    draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Delivery zones' })).toBeInTheDocument()
    expect(within(cardOf(12)).getByRole('checkbox', { name: 'Active' })).not.toBeChecked()
    await user.click(within(cardOf(12)).getByRole('checkbox', { name: 'Active' }))
    expect(handlers.onToggle.mock.calls[0][0].id).toBe(12)
    expect(handlers.onToggle.mock.calls[0][1]).toBe(true)
    expect(handlers.onOpen).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(handlers.onToggleAll).toHaveBeenCalledWith(true)
  })

  it('with activeControl="switch", each card has a switch «Active: <name>» that does not open the card', async () => {
    const user = userEvent.setup()
    draw({ activeControl: 'switch' })
    const off = within(cardOf(12)).getByRole('switch', { name: 'Active: Ring' })
    expect(off).toHaveAttribute('aria-checked', 'false')
    expect(within(cardOf(12)).queryByRole('checkbox')).toBeNull()
    expect(within(cardOf(11)).getByRole('switch', { name: 'Active: Centre' })).toHaveAttribute('aria-checked', 'true')
    await user.click(off)
    expect(handlers.onToggle.mock.calls[0][0].id).toBe(12)
    expect(handlers.onToggle.mock.calls[0][1]).toBe(true)
    expect(handlers.onOpen).not.toHaveBeenCalled()
  })

  it('opens the zone with the card link, marks the selected card and the mixed Select all', async () => {
    const user = userEvent.setup()
    draw({ activeControl: 'switch', selectedId: 11 })
    expect(cardOf(11)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
    await user.click(within(cardOf(12)).getByRole('link', { name: 'Ring' }))
    expect(handlers.onOpen.mock.calls[0][0].id).toBe(12)
  })
})
