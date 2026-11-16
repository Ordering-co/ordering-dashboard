/* eslint-disable import/first */
// redesign stores 5.8: the zones of the Delivery tab are the rows of a P/ZonesTable and the open zone is the detail of a
// P/SectionSplit that wraps the tab (DeliveryZonesSplit). Real: SectionSplit, ZonesTable, DataTable, Switch, Checkbox, Button.
// Simulated: the language, the utils (addQueryToUrl / removeQueryToUrl), the window width and BusinessDeliveryZoneDetails (another lane;
// the stub paints a <form> with the id of the zone it is given and a button that calls onClose).
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn(), width: 1280 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$ ${Number(value).toFixed(2)}` }]
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQueryToUrl, removeQueryToUrl: mocks.removeQueryToUrl }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: mocks.width }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../BusinessDeliveryZoneDetails', () => ({
  BusinessDeliveryZoneDetails: ({ zone, onClose }) => (
    <form data-testid='zone-form' data-zone-id={String(zone?.id)}>
      <span>{zone ? `Editing ${zone.name}` : 'Editing a new zone'}</span>
      <button type='button' onClick={onClose}>Stub close</button>
    </form>
  )
}))

import { DeliveryZonesSplit } from '../DeliveryZonesSplit'
import { BusinessDeliveryZoneList } from '../index'

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

const ZONES = () => ([
  { id: 11, name: 'Centre', type: 1, enabled: true, minimum: 10, price: 2.5, data: { center: { lat: 41, lng: -73 }, radio: 2 } },
  { id: 12, name: 'Ring', type: 2, enabled: false, minimum: 0, price: 5, data: [] },
  { id: 13, name: 'Hidden legacy', type: 3, enabled: true, minimum: 1, price: 1, data: [] }
])

// The tab: a <form> (the tab of Delivery is one) with a field of its own and the list, inside the split
const Host = ({ zones = ZONES(), zoneListState = { changes: {}, isCheckAll: false }, handlers = {} }) => (
  <DeliveryZonesSplit
    business={{ id: 7, zones }}
    setIsExtendExtraOpen={handlers.setIsExtendExtraOpen || vi.fn()}
    handleSuccessUpdate={vi.fn()}
  >
    <form data-testid='delivery-form' onSubmit={event => event.preventDefault()}>
      <input aria-label='Delivery time draft' />
      <BusinessDeliveryZoneList
        business={{ id: 7, zones }}
        setIsExtendExtraOpen={handlers.setIsExtendExtraOpen || vi.fn()}
        onClose={vi.fn()}
        handleSuccessUpdate={vi.fn()}
        zoneListState={zoneListState}
        handleChangeZoneState={handlers.handleChangeZoneState || vi.fn()}
        handleChangeAllZoneState={handlers.handleChangeAllZoneState || vi.fn()}
      />
    </form>
  </DeliveryZonesSplit>
)

// the link is read from window.location (the tab is drawn outside a Router in the test of 5.7)
const at = url => window.history.pushState({}, '', url)
const mount = (hostProps = {}, url = '/stores/list?id=7&section=delivery_pickup_more') => {
  at(url)
  return render(<Host {...hostProps} />)
}
const rowOf = id => document.querySelector(`tr[data-row-id="${id}"]`)
const zoneArgs = () => [...mocks.addQueryToUrl.mock.calls, ...mocks.removeQueryToUrl.mock.calls]

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.width = 1280
  mocks.addQueryToUrl.mockClear()
  mocks.removeQueryToUrl.mockClear()
})
afterEach(() => {
  cleanup()
  at('/')
  vi.unstubAllGlobals()
})

describe('BusinessDeliveryZoneList · opening a zone', () => {
  it('(a) opens the zone of a clicked row as the detail and writes it to the URL', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.queryByTestId('zone-form')).toBeNull()

    await user.click(within(rowOf(12)).getByText('$ 5.00'))

    expect(screen.getByTestId('zone-form').getAttribute('data-zone-id')).toBe('12')
    expect(screen.getByRole('heading', { level: 3, name: 'Ring' })).toBeTruthy()
    expect(mocks.addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ zone: 12 })
    expect(within(rowOf(12)).getByRole('button', { name: 'Ring' }).getAttribute('aria-current')).toBe('true')
  })

  it('(b) opens the zone with Enter on the focused row', async () => {
    const user = userEvent.setup()
    mount()
    act(() => rowOf(11).focus())
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('zone-form').getAttribute('data-zone-id')).toBe('11')
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ zone: 11 })
  })

  it('(c) «Add delivery zone» opens a new zone and never writes zone=undefined', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))

    expect(screen.getByTestId('zone-form').getAttribute('data-zone-id')).toBe('undefined')
    expect(screen.getByRole('heading', { level: 3, name: 'Zone delivery settings' })).toBeTruthy()
    expect(zoneArgs().some(([arg]) => arg && typeof arg === 'object' && !Array.isArray(arg) && 'zone' in arg)).toBe(false)
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['zone', 'zone_tab'])
  })

  it('does not draw the zones of type 3', () => {
    mount()
    expect(rowOf(11)).not.toBeNull()
    expect(rowOf(13)).toBeNull()
  })
})

describe('BusinessDeliveryZoneList · the link ?zone=', () => {
  it('(d) opens the zone of the URL when the zones arrive after the first render, with no timer', () => {
    at('/stores/list?id=7&zone=12&zone_tab=map')
    const { rerender } = render(<Host zones={null} />)
    expect(screen.queryByTestId('zone-form')).toBeNull()
    expect(screen.queryByText("This delivery zone doesn't exist or was deleted.")).toBeNull()

    rerender(<Host zones={ZONES()} />)

    expect(screen.getByTestId('zone-form').getAttribute('data-zone-id')).toBe('12')
    // it is what the URL already says: nothing is written or removed
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('(e) says so and leaves zone out of the URL when the zone does not exist', () => {
    mount({}, '/stores/list?id=7&zone=999&zone_tab=map')

    expect(screen.getByText("This delivery zone doesn't exist or was deleted.")).toBeTruthy()
    expect(screen.queryByTestId('zone-form')).toBeNull()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['zone', 'zone_tab'])
  })

  it('a zone of type 3 is not found either', () => {
    mount({}, '/stores/list?id=7&zone=13')
    expect(screen.getByText("This delivery zone doesn't exist or was deleted.")).toBeTruthy()
    expect(screen.queryByTestId('zone-form')).toBeNull()
  })
})

describe('BusinessDeliveryZoneList · the Active switch and Select all', () => {
  it('(f) names the switch with the zone, reports the next value and does not open the row', async () => {
    const user = userEvent.setup()
    const handleChangeZoneState = vi.fn()
    mount({ handlers: { handleChangeZoneState }, zoneListState: { changes: { 12: false }, isCheckAll: false } })

    const toggle = within(rowOf(12)).getByRole('switch', { name: 'Active: Ring' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await user.click(toggle)

    expect(handleChangeZoneState).toHaveBeenCalledWith(12, true)
    expect(screen.queryByTestId('zone-form')).toBeNull()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('shows the stored state of each switch', () => {
    mount({ zoneListState: { changes: { 11: true }, isCheckAll: false } })
    expect(screen.getByRole('switch', { name: 'Active: Centre' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Active: Ring' }).getAttribute('aria-checked')).toBe('false')
  })

  it('Select all reports the next value to the controller', async () => {
    const user = userEvent.setup()
    const handleChangeAllZoneState = vi.fn()
    mount({ handlers: { handleChangeAllZoneState } })
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(handleChangeAllZoneState).toHaveBeenCalledWith(true)
  })

  it('(g) with no zones, Select all is never checked and the list says it is empty', () => {
    mount({ zones: [], zoneListState: { changes: {}, isCheckAll: true } })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toBeChecked()
    expect(screen.getByText('No delivery zones yet')).toBeTruthy()
  })
})

describe('BusinessDeliveryZoneList · the detail and the form of the tab', () => {
  it('(h) the form of the detail is not inside another form', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(within(rowOf(11)).getByText('$ 10.00'))

    const detailForm = screen.getByTestId('zone-form')
    expect(screen.getByTestId('delivery-form')).toBeTruthy()
    expect(detailForm.parentElement.closest('form')).toBeNull()
    expect(screen.getByTestId('delivery-form').contains(detailForm)).toBe(false)
  })

  it('(i) at phone width a field of the tab keeps what was typed after opening a zone and coming back', async () => {
    mocks.width = 390
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText('Delivery time draft'), '2:30')
    await user.click(within(rowOf(11)).getByText('$ 10.00'))

    // stack: the detail replaces the list, which stays mounted
    expect(screen.getByTestId('zone-form')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.queryByTestId('zone-form')).toBeNull()
    expect(screen.getByLabelText('Delivery time draft').value).toBe('2:30')
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['zone', 'zone_tab'])
  })

  it('(j) closing with the X removes zone and zone_tab from the URL', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(within(rowOf(11)).getByText('$ 10.00'))
    mocks.removeQueryToUrl.mockClear()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByTestId('zone-form')).toBeNull()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['zone', 'zone_tab'])
  })

  it('closes with the button the detail calls onClose from, and switches from one zone to another', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(within(rowOf(11)).getByText('$ 10.00'))
    await user.click(within(rowOf(12)).getByText('$ 5.00'))
    expect(screen.getByTestId('zone-form').getAttribute('data-zone-id')).toBe('12')
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ zone: 12 })

    await user.click(screen.getByRole('button', { name: 'Stub close' }))
    expect(screen.queryByTestId('zone-form')).toBeNull()
  })

  // review R5.8-02: at phone width a zone opened from low in the list starts at its header, not halfway down its form
  it('at phone width the opened zone is scrolled to its top; side by side it is not', async () => {
    const scrolled = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) { scrolled.push([this.className, options]) }
    try {
      mocks.width = 390
      const user = userEvent.setup()
      const { unmount } = mount()
      await user.click(within(rowOf(11)).getByText('$ 10.00'))
      await waitFor(() => expect(scrolled).toEqual([['odc-section-split-detail', { block: 'start' }]]))
      unmount()

      scrolled.length = 0
      mocks.width = 1280
      mount()
      await user.click(within(rowOf(11)).getByText('$ 10.00'))
      await new Promise(resolve => requestAnimationFrame(resolve))
      expect(scrolled).toEqual([])
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('tells the shell to give the section the full width while a zone is open', async () => {
    const user = userEvent.setup()
    const setIsExtendExtraOpen = vi.fn()
    mount({ handlers: { setIsExtendExtraOpen } })
    await user.click(within(rowOf(11)).getByText('$ 10.00'))
    expect(setIsExtendExtraOpen).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(setIsExtendExtraOpen).toHaveBeenLastCalledWith(false)
  })

  it('draws the list without a provider: Add does nothing and nothing throws', async () => {
    const user = userEvent.setup()
    render(
      <BusinessDeliveryZoneList
        business={{ id: 7, zones: ZONES() }}
        zoneListState={{ changes: {}, isCheckAll: false }}
        handleChangeZoneState={vi.fn()}
        handleChangeAllZoneState={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })
})
