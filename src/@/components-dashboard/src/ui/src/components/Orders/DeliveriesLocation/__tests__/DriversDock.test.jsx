/* eslint-disable import/first */
// redesign deliveries F2-B2 (decisions 1 and 3; DV-06, DV-13): the drivers dock under the map and assigning from the board.
// The dock is read through DeliveriesLocation, the one place that owns the candidates request and the map.
import React, { useState } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  controls: null,
  save: null,
  configs: {},
  dictionary: {},
  showToast: null
}))

vi.mock('../../../../../../index', () => {
  const ordering = {
    setAccessToken: () => ({
      controls: (id) => ({ get: () => mocks.controls(id) }),
      orders: (id) => ({ save: (payload) => mocks.save(id, payload) })
    })
  }
  const t = (key, fallback) => mocks.dictionary[key] ?? fallback
  return {
    useLanguage: () => [null, t],
    useConfig: () => [{ configs: mocks.configs }],
    useApi: () => [ordering],
    useSession: () => [{ token: 'token' }]
  }
})
vi.mock('google-map-react', () => ({
  default: (props) => <div data-testid='google-map'>{props.children}</div>,
  fitBounds: () => ({ center: { lat: 5, lng: 6 }, zoom: 7 })
}))
vi.mock('../../InterActOrderMarker', () => ({ InterActOrderMarker: () => <i data-testid='marker' /> }))

import { DeliveriesLocation } from '..'
import { ToastContext, ToastType } from '../../../../../../contexts/ToastContext'
import { UtilsContext } from '../../../../../../contexts/UtilsContext'

const drivers = [
  { id: 1, name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, busy: false, assigned_orders_count: 3, cellphone: '+15550001', last_location_at: '2026-10-09 10:00:00', location: { lat: 1, lng: 2 } },
  { id: 2, name: 'Linh', lastname: 'Nguyen', enabled: true, available: true, busy: false, assigned_orders_count: 1, location: { lat: 1, lng: 2 } },
  { id: 3, name: 'Bo', lastname: 'Chen', enabled: true, available: true, busy: true, assigned_orders_count: 2, location: { lat: 1, lng: 2 } },
  { id: 4, name: 'Cy', lastname: 'Dahl', enabled: true, available: false, busy: false, assigned_orders_count: 0, location: { lat: 1, lng: 2 } },
  { id: 5, name: 'Ed', lastname: 'Hidden', enabled: false, available: true, busy: false, assigned_orders_count: 0 },
  { id: 6, name: 'Di', lastname: 'Park', enabled: true, available: true, busy: true, assigned_orders_count: 0, location: { lat: 1, lng: 2 } }
]
const candidates = [
  { id: 2, name: 'Linh', lastname: 'Nguyen', available: true, busy: false, assigned_orders_count: 1 },
  { id: 1, name: 'Ada', lastname: 'Lovelace', available: true, busy: false, assigned_orders_count: 3 }
]
const unassigned = { id: 77, driver: null, driver_id: null, business: { location: { lat: 1, lng: 2 } }, customer: { location: { lat: 3, lng: 4 } } }
const controlsOk = (list = candidates) => async () => ({ content: { error: false, result: { drivers: list } } })

const Providers = ({ children }) => (
  <ToastContext.Provider value={[null, { showToast: mocks.showToast, hideToast: () => {} }]}>
    <UtilsContext.Provider value={[{ parseDate: (date) => `parsed ${date}` }]}>
      {children}
    </UtilsContext.Provider>
  </ToastContext.Provider>
)

const renderDock = (props = {}) => renderWithProviders(
  <DeliveriesLocation
    driversList={{ loading: false, drivers }}
    interActionMapOrder={null}
    canAssign={() => true}
    {...props}
  />,
  { wrapper: Providers }
)
const dock = () => screen.getByRole('region', { name: /^Drivers|^Candidates/ })

beforeEach(() => {
  mocks.controls = vi.fn(controlsOk())
  mocks.save = vi.fn(async () => ({ content: { error: false, result: {} } }))
  mocks.showToast = vi.fn()
  mocks.configs = { google_maps_api_key: { value: 'key' } }
  mocks.dictionary = {}
  document.getElementById('app-modals')?.remove()
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('DriversDock · nothing chosen', () => {
  it('says how many are available and busy, outside the map frame', () => {
    renderDock()
    const region = dock()
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('Drivers')
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('2 available · 2 busy')
    expect(within(region).getByRole('heading', { level: 2 })).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('region', { name: 'Delivery map' })).not.toContainElement(region)
    expect(mocks.controls).not.toHaveBeenCalled()
  })

  // redesign tanda AB (O-2): the date of the last location had its label only as a title and as sr-only text; the label is
  // written beside the date, once (as /all-in-one writes «No recent location · 10 months ago»), so it is neither hidden nor read twice.
  it('writes «Last location» beside the date of the last signal, once, with no hidden copy', () => {
    renderDock()
    const ada = within(dock()).getAllByRole('listitem').find(row => row.textContent.includes('Ada Lovelace'))
    const signal = ada.querySelector('.odc-dock-signal')
    expect(signal).toHaveTextContent('Last location · parsed 2026-10-09 10:00:00')
    expect(signal.querySelector('.odc-sr-only')).toBeNull()
    expect(signal).not.toHaveAttribute('title')
    expect(within(ada).getAllByText(/Last location/)).toHaveLength(1)
  })

  it('lists enabled drivers: available first, then busy, fewest assigned orders first, offline last', () => {
    renderDock()
    const names = within(dock()).getAllByRole('listitem').map(row => row.querySelector('.odc-dock-name').textContent)
    expect(names).toEqual(['Linh Nguyen', 'Ada Lovelace', 'Di Park', 'Bo Chen', 'Cy Dahl'])
    expect(within(dock()).queryByText(/Hidden/)).toBeNull()
  })

  it('shows status as text, the assigned orders with the count as a figure, the last signal and a call link', () => {
    renderDock()
    const ada = within(dock()).getAllByRole('listitem').find(row => row.textContent.includes('Ada Lovelace'))
    expect(within(ada).getByText('Available')).toBeInTheDocument()
    expect(ada.querySelector('.odc-dock-orders .odc-figure')).toHaveTextContent('3')
    expect(ada.querySelector('.odc-dock-orders')).toHaveTextContent('3 assigned orders')
    expect(ada.querySelector('.odc-dock-signal .odc-figure')).toHaveTextContent('parsed 2026-10-09 10:00:00')
    const call = within(ada).getByRole('link', { name: 'Call Ada Lovelace' })
    expect(call).toHaveAttribute('href', 'tel:+15550001')
    const linh = within(dock()).getAllByRole('listitem').find(row => row.textContent.includes('Linh Nguyen'))
    expect(linh.querySelector('.odc-dock-orders')).toHaveTextContent('1 assigned order')
    expect(within(linh).queryByRole('link')).toBeNull()
    expect(linh.querySelector('.odc-dock-signal')).toBeNull()
    const states = within(dock()).getAllByRole('listitem').map(row => row.dataset.state)
    expect(states).toEqual(['available', 'available', 'busy', 'busy', 'offline'])
    expect(within(dock()).getByText('Offline')).toBeInTheDocument()
  })

  it('draws a skeleton while the drivers load', () => {
    renderDock({ driversList: { loading: true, drivers: [] } })
    expect(dock().querySelectorAll('[data-skeleton-row]')).toHaveLength(3)
  })

  it('stays useful when the map is unavailable', () => {
    renderDock()
    expect(screen.getByRole('region', { name: /^Drivers/ })).toBeInTheDocument()
  })
})

describe('DriversDock · order without a driver', () => {
  it('lists the candidates the controls request returns, in one request', async () => {
    renderDock({ interActionMapOrder: unassigned })
    expect(await screen.findByRole('heading', { level: 2, name: /Candidates for #77/ })).toBeInTheDocument()
    expect(dock().querySelector('.odc-figure')).toHaveTextContent('77')
    await waitFor(() => expect(within(dock()).getAllByRole('listitem')).toHaveLength(2))
    expect(mocks.controls).toHaveBeenCalledTimes(1)
    expect(mocks.controls).toHaveBeenCalledWith(77)
    expect(within(dock()).getAllByRole('listitem').map(row => row.querySelector('.odc-dock-name').textContent)).toEqual(['Linh Nguyen', 'Ada Lovelace'])
  })

  it('draws a three-row skeleton while the candidates load', async () => {
    let release
    mocks.controls = vi.fn(() => new Promise(resolve => { release = () => resolve({ content: { error: false, result: { drivers: candidates } } }) }))
    renderDock({ interActionMapOrder: unassigned })
    expect(dock().querySelectorAll('[data-skeleton-row]')).toHaveLength(3)
    expect(dock()).toHaveAttribute('aria-busy', 'true')
    await act(async () => { release() })
    expect(dock().querySelectorAll('[data-skeleton-row]')).toHaveLength(0)
  })

  it('puts «Assign» on each candidate, primary on the first, only when canAssign(order)', async () => {
    renderDock({ interActionMapOrder: unassigned })
    const first = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    const second = screen.getByRole('button', { name: 'Assign Ada Lovelace to order 77' })
    expect(first).toHaveAttribute('data-variant', 'primary')
    expect(second).toHaveAttribute('data-variant', 'secondary')
    expect(first).toHaveTextContent('Assign')
  })

  it('has no «Assign» when canAssign says no, or when nothing was passed', async () => {
    const view = renderDock({ interActionMapOrder: unassigned, canAssign: () => false })
    await waitFor(() => expect(within(dock()).getAllByRole('listitem')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull()
    view.unmount()
    renderDock({ interActionMapOrder: unassigned, canAssign: undefined })
    await waitFor(() => expect(within(dock()).getAllByRole('listitem')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull()
  })

  it('numbers the order by external id when the project asks for it', async () => {
    mocks.configs = { ...mocks.configs, change_order_id: { value: '1' } }
    renderDock({ interActionMapOrder: { ...unassigned, external_id: 'EXT-9' } })
    expect(await screen.findByRole('heading', { level: 2, name: /Candidates for #EXT-9/ })).toBeInTheDocument()
  })

  it('says the truth when nobody can take the order (DV-06)', async () => {
    mocks.controls = vi.fn(controlsOk([]))
    renderDock({ interActionMapOrder: unassigned })
    expect(await screen.findByText('No driver can take this order right now')).toBeInTheDocument()
    expect(screen.queryByText('No Drivers Available for Order')).toBeNull()
    expect(screen.getByRole('region', { name: /Candidates for #77/ })).toBeInTheDocument()
  })

  it('does not break when the controls request answers an error, and offers a retry (DV-13)', async () => {
    mocks.controls = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['Something failed'] } })
      .mockResolvedValueOnce({ content: { error: false, result: { drivers: candidates } } })
    renderDock({ interActionMapOrder: unassigned })
    const notice = await screen.findByText("We couldn't load the candidates.")
    expect(notice).toBeInTheDocument()
    expect(within(dock()).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByText('No driver can take this order right now')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(within(dock()).getAllByRole('listitem')).toHaveLength(2))
    expect(mocks.controls).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("We couldn't load the candidates.")).toBeNull()
  })

  it('does not break when the controls request throws (DV-13)', async () => {
    mocks.controls = vi.fn(async () => { throw new Error('network') })
    renderDock({ interActionMapOrder: unassigned })
    expect(await screen.findByText("We couldn't load the candidates.")).toBeInTheDocument()
  })

  it('ignores the answer of a request for an order that is no longer chosen', async () => {
    let releaseFirst
    mocks.controls = vi.fn((id) => id === 77
      ? new Promise(resolve => { releaseFirst = () => resolve({ content: { error: false, result: { drivers: [candidates[0]] } } }) })
      : Promise.resolve({ content: { error: false, result: { drivers: [candidates[1]] } } }))
    const view = renderDock({ interActionMapOrder: unassigned })
    view.rerender(
      <DeliveriesLocation driversList={{ loading: false, drivers }} interActionMapOrder={{ ...unassigned, id: 78 }} canAssign={() => true} />
    )
    await screen.findByRole('button', { name: 'Assign Ada Lovelace to order 78' })
    await act(async () => { releaseFirst() })
    expect(screen.queryByRole('button', { name: /Linh/ })).toBeNull()
  })
})

describe('DriversDock · order with a driver', () => {
  const assigned = { ...unassigned, id: 80, driver_id: 1, driver: { id: 1, name: 'Ada', lastname: 'Lovelace', cellphone: '+15550001' } }

  it('shows the driver row without «Assign» and without asking for candidates', () => {
    renderDock({ interActionMapOrder: assigned })
    const rows = within(dock()).getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Ada Lovelace')
    expect(within(rows[0]).getByRole('link', { name: 'Call Ada Lovelace' })).toBeInTheDocument()
    expect(within(rows[0]).getByText('Available')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull()
    expect(mocks.controls).not.toHaveBeenCalled()
  })

  it('shows a driver company or an external driver by name, without «Assign»', async () => {
    renderDock({ interActionMapOrder: { ...unassigned, id: 81, driver: null, driver_company_id: 4, driver_company: { name: 'Fast Co' } } })
    await act(async () => {}) // the effect of today still asks `controls` for an order whose `driver` is null (the map frames its candidates)
    expect(within(dock()).getByText('Fast Co')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull()
  })
})

describe('DriversDock · assigning', () => {
  it('sends one save({ driver_id }), shows busy meanwhile, then toasts and tells the page', async () => {
    let release
    mocks.save = vi.fn(() => new Promise(resolve => { release = () => resolve({ content: { error: false, result: {} } }) }))
    const onAssigned = vi.fn()
    renderDock({ interActionMapOrder: unassigned, onAssigned })
    const button = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    await userEvent.click(button)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith(77, { driver_id: 2 })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Assign Ada Lovelace to order 77' }))
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(onAssigned).not.toHaveBeenCalled()
    await act(async () => { release() })
    expect(onAssigned).toHaveBeenCalledTimes(1)
    expect(onAssigned.mock.calls[0][0]).toMatchObject({ id: 77 })
    expect(onAssigned.mock.calls[0][1]).toMatchObject({ id: 2 })
    expect(mocks.showToast).toHaveBeenCalledWith(ToastType.Success, 'Driver assigned to order')
    expect(button).not.toHaveAttribute('aria-busy')
  })

  it('asks for the comment first when the project requires it, and will not send an empty one', async () => {
    mocks.configs = { ...mocks.configs, manual_driver_assignment_comment_enabled: { value: '1' } }
    renderDock({ interActionMapOrder: unassigned })
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    expect(mocks.save).not.toHaveBeenCalled()
    const field = within(dialog).getByRole('textbox')
    await waitFor(() => expect(field).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    expect(await within(dialog).findByText('This field is required')).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
    await userEvent.type(field, 'Closest to the store')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith(77, { manual_driver_assignment_comment: 'Closest to the store', driver_id: 2 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes the comment dialog on Cancel without sending', async () => {
    mocks.configs = { ...mocks.configs, manual_driver_assignment_comment_enabled: { value: '1' } }
    renderDock({ interActionMapOrder: unassigned })
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('shows a translated alert with «Retry» that repeats the same assignment, and keeps the focus on the page', async () => {
    mocks.dictionary = { DRIVER_NOT_AVAILABLE: 'El repartidor no está disponible' }
    mocks.save = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['DRIVER_NOT_AVAILABLE'] } })
      .mockResolvedValueOnce({ content: { error: false, result: {} } })
    const onAssigned = vi.fn()
    renderDock({ interActionMapOrder: unassigned, onAssigned })
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('El repartidor no está disponible')
    expect(dock()).toContainElement(alert)
    expect(onAssigned).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(document.body)
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1]).toEqual(mocks.save.mock.calls[0])
    await waitFor(() => expect(onAssigned).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('DriversDock · focusCandidatesToken', () => {
  const same = (props) => (
    <DeliveriesLocation driversList={{ loading: false, drivers }} canAssign={() => true} {...props} />
  )

  it('moves the focus to the first «Assign» when the token changes and there are candidates', async () => {
    const view = renderDock({ interActionMapOrder: unassigned, focusCandidatesToken: 0 })
    const first = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    expect(first).not.toHaveFocus()
    view.rerender(same({ interActionMapOrder: unassigned, focusCandidatesToken: 1 }))
    await waitFor(() => expect(first).toHaveFocus())
  })

  it('waits for the candidates of a newly chosen order before moving the focus', async () => {
    const view = renderDock({ interActionMapOrder: null, focusCandidatesToken: 0 })
    view.rerender(same({ interActionMapOrder: unassigned, focusCandidatesToken: 1 }))
    const first = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    await waitFor(() => expect(first).toHaveFocus())
  })

  it('moves the focus to the title of the dock when there are no candidates', async () => {
    mocks.controls = vi.fn(controlsOk([]))
    const view = renderDock({ interActionMapOrder: unassigned, focusCandidatesToken: 0 })
    await screen.findByText('No driver can take this order right now')
    view.rerender(same({ interActionMapOrder: unassigned, focusCandidatesToken: 1 }))
    await waitFor(() => expect(within(dock()).getByRole('heading', { level: 2 })).toHaveFocus())
  })

  it('does nothing on the first render', async () => {
    renderDock({ interActionMapOrder: unassigned, focusCandidatesToken: 3 })
    await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    expect(document.activeElement).toBe(document.body)
    fireEvent.focus(document.body)
  })
})

// redesign deliveries R1 (finding 4): the control that was pressed goes away (the order gets its driver, the notice gives way to the
// request, the dialog closes). The focus lands on a control of the strip, never on <body>. The board is played by a small parent that
// does what DeliveryDashboard does with onAssigned: it puts the driver on the chosen order.
describe('DriversDock · the focus never falls to <body>', () => {
  const Board = (props) => {
    const [order, setOrder] = useState(unassigned)
    return (
      <DeliveriesLocation
        driversList={{ loading: false, drivers }}
        interActionMapOrder={order}
        canAssign={() => true}
        onAssigned={(_, driver) => setOrder(previous => ({ ...previous, driver_id: driver.id, driver }))}
        {...props}
      />
    )
  }
  const renderBoard = (props) => renderWithProviders(<Board {...props} />, { wrapper: Providers })
  const title = () => within(dock()).getByRole('heading', { level: 2 })

  it('after assigning, the strip title has it (the assigned driver row replaces the candidates)', async () => {
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull())
    expect(within(dock()).getAllByRole('listitem')).toHaveLength(1)
    await waitFor(() => expect(title()).toHaveFocus())
    expect(document.activeElement).not.toBe(document.body)
  })

  it('after the keyboard assigns (Enter on the button), the same', async () => {
    renderBoard()
    const button = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    button.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(title()).toHaveFocus())
  })

  it('after submitting the comment dialog, the strip title has it', async () => {
    mocks.configs = { ...mocks.configs, manual_driver_assignment_comment_enabled: { value: '1' } }
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await userEvent.type(within(dialog).getByRole('textbox'), 'Closest to the store')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(title()).toHaveFocus())
  })

  it('after «Retry» of a failed assignment that now works, the strip title has it', async () => {
    mocks.save = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['DRIVER_NOT_AVAILABLE'] } })
      .mockResolvedValueOnce({ content: { error: false, result: {} } })
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    const alert = await screen.findByRole('alert')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await waitFor(() => expect(title()).toHaveFocus())
  })

  it('after «Retry» of a failed assignment that fails again, the focus is still inside the strip', async () => {
    mocks.save = vi.fn(async () => ({ content: { error: true, result: ['DRIVER_NOT_AVAILABLE'] } }))
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    await userEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    await screen.findByRole('alert')
    await waitFor(() => expect(dock()).toContainElement(document.activeElement))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('after «Retry» of «We couldn\'t load the candidates.», the first «Assign» has it', async () => {
    mocks.controls = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['Something failed'] } })
      .mockResolvedValueOnce({ content: { error: false, result: { drivers: candidates } } })
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    const first = await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' })
    await waitFor(() => expect(first).toHaveFocus())
  })

  it('after «Retry» of the candidates that fails again or finds nobody, the strip title has it', async () => {
    mocks.controls = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['Something failed'] } })
      .mockResolvedValueOnce({ content: { error: false, result: { drivers: [] } } })
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await screen.findByText('No driver can take this order right now')
    await waitFor(() => expect(title()).toHaveFocus())
  })

  it('does not take the focus from a control the user went to while the request was in flight', async () => {
    let release
    mocks.save = vi.fn(() => new Promise(resolve => { release = () => resolve({ content: { error: false, result: {} } }) }))
    renderBoard()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    await userEvent.click(await screen.findByRole('button', { name: 'Assign Linh Nguyen to order 77' }))
    outside.focus()
    await act(async () => { release() })
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Assign/ })).toBeNull())
    expect(outside).toHaveFocus()
    outside.remove()
  })
})
