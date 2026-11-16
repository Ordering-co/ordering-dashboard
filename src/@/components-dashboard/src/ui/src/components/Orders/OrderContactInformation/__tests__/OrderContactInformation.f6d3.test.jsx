/* eslint-disable import/first */
// redesign F6d-3 (P4-02): the card of the assigned driver goes away only when the driver selector is on the page AND
// its trigger shows that same driver. These tests mount the real DriverSelector and the real select (the controller is
// the only stub: it hands over the list the API would), so the cases that used to leave the panel without any driver
// (driver missing from the order's candidates, the request failed, still loading, the assignment comment open) are
// the ones the selector really produces. Q2-21: the four labels of Edit customer are the same element and class.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const runtime = vi.hoisted(() => ({ driversList: { loading: false, drivers: [] }, configs: {} }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} id={props.id} />,
  GoogleMapsMap: () => <div />,
  useConfig: () => [{ configs: runtime.configs }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }],
  DriversList: ({ UIComponent, ...props }) => (
    <UIComponent {...props} driversList={runtime.driversList} driverActionStatus={{}} companyActionStatus={{}} handleAssignDriver={vi.fn()} />
  )
}))

vi.mock('../../../../utils', () => ({ getUserType: () => false }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => null }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const order = {
  id: 42,
  status: 7,
  delivery_type: 1,
  business: { name: 'Restaurant' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace', cellphone: '5552000', address: '200 Customer Street' },
  driver_id: 9,
  driver: { name: 'Dan', middle_name: 'Quincy', lastname: 'Driver', second_lastname: 'Smith', cellphone: '5559000' }
}

const drivers = {
  assigned: { id: 9, name: 'Dan', lastname: 'Driver', enabled: true, available: true, busy: false, assigned_orders_count: 1 },
  other: { id: 3, name: 'Eve', lastname: 'Rider', enabled: true, available: true, busy: false, assigned_orders_count: 0 }
}

const props = (extra = {}) => ({
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn(),
  order,
  ...extra
})

const renderPanel = (extra) => renderWithProviders(
  <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
    <OrderContactInformation {...props(extra)} />
  </SelectSurfaceContext.Provider>
)

const section = () => screen.getByRole('region', { name: 'Business and driver' })
const card = () => section().querySelectorAll('.odt-party')

beforeEach(() => {
  runtime.driversList = { loading: false, drivers: [] }
  runtime.configs = {}
})

describe('the driver card and the driver selector (P4-02)', () => {
  it('leaves the person to the selector when its trigger shows that driver, and keeps the phone', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.assigned, drivers.other] }
    renderPanel()
    await waitFor(() => expect(card()).toHaveLength(1))
    // redesign F6e-2 (P5-03): the field carries the full name (the card is gone, nothing else shows the middle names)
    expect(section().querySelector('.od-first-select-trigger')).toHaveTextContent('Dan Quincy Driver Smith')
    expect(within(section()).getByRole('button', { name: 'Call Dan' }).closest('.odt-assign')).not.toBeNull()
    expect(within(section()).getAllByRole('button', { name: 'Call Dan' })).toHaveLength(1)
  })

  // redesign F6e-2 (Q4-02): the card goes by id, not by comparing texts, so a name the API pads with spaces does not bring it back
  it('hides the card of a driver whose name comes padded with spaces («Marco » + «Test»)', async () => {
    const padded = { name: 'Marco ', lastname: 'Test' }
    runtime.driversList = { loading: false, drivers: [{ ...drivers.assigned, ...padded }] }
    renderPanel({ order: { ...order, driver: { ...order.driver, ...padded, middle_name: null, second_lastname: null } } })
    await waitFor(() => expect(card()).toHaveLength(1))
    expect(section().querySelector('.od-first-select-trigger .odc-so-label').textContent).toBe('Marco Test')
    expect(within(section()).getAllByRole('button', { name: 'Call Marco' })).toHaveLength(1)
  })

  it('names the call button and the card without stray spaces when the selector cannot show the driver', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.other] }
    renderPanel({ order: { ...order, driver: { ...order.driver, name: 'Marco ', middle_name: '', second_lastname: undefined, lastname: 'Test' } } })
    await waitFor(() => expect(card()).toHaveLength(2))
    // redesign F6h: the name is a <bdi> inside the card's name element
    expect(within(section()).getByText('Marco Test').closest('.odt-party-name')).not.toBeNull()
    expect(within(section()).getByRole('button', { name: 'Call Marco' })).toBeInTheDocument()
  })

  it('does not hide the card of a driver the selector shows under another id', async () => {
    runtime.driversList = { loading: false, drivers: [{ ...drivers.assigned, id: 10 }, drivers.other] }
    renderPanel()
    await waitFor(() => expect(card()).toHaveLength(2))
    expect(within(section()).getByText('Dan Quincy Driver Smith')).toBeInTheDocument()
  })

  it('shows the card again if the order gets another driver the selector does not list', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.assigned] }
    const view = renderPanel()
    await waitFor(() => expect(card()).toHaveLength(1))
    await act(async () => {
      view.rerender(
        <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
          <OrderContactInformation {...props({ order: { ...order, driver_id: 77, driver: { name: 'Zoe', lastname: 'Far' } } })} />
        </SelectSurfaceContext.Provider>
      )
    })
    await waitFor(() => expect(card()).toHaveLength(2))
    expect(within(section()).getByText('Zoe Far')).toBeInTheDocument()
  })

  it('keeps the card, with the full name and the phone, when the driver is not among the selector options', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.other] }
    renderPanel()
    await waitFor(() => expect(card()).toHaveLength(2))
    expect(within(section()).getByText('Dan Quincy Driver Smith')).toBeInTheDocument()
    expect(within(section()).getAllByRole('button', { name: 'Call Dan' })).toHaveLength(1)
    expect(within(section()).getByRole('button', { name: 'Call Dan' }).closest('.odt-party')).not.toBeNull()
  })

  it('keeps the card when the request failed and the list came back empty', async () => {
    runtime.driversList = { loading: false, drivers: [], error: 'Network error' }
    renderPanel()
    await waitFor(() => expect(card()).toHaveLength(2))
    expect(within(section()).getByText('Dan Quincy Driver Smith')).toBeInTheDocument()
  })

  it('keeps the card while the selector is still loading («loading…» is not the driver)', async () => {
    runtime.driversList = { loading: true, drivers: [] }
    renderPanel()
    expect(section().querySelector('.od-first-select-trigger')).toHaveTextContent(/loading/i)
    expect(card()).toHaveLength(2)
    expect(within(section()).getByText('Dan Quincy Driver Smith')).toBeInTheDocument()
  })

  it('goes back to the selector alone when the list arrives with the driver in it', async () => {
    runtime.driversList = { loading: true, drivers: [] }
    const view = renderPanel()
    expect(card()).toHaveLength(2)
    runtime.driversList = { loading: false, drivers: [drivers.assigned] }
    await act(async () => {
      view.rerender(
        <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
          <OrderContactInformation {...props()} />
        </SelectSurfaceContext.Provider>
      )
    })
    await waitFor(() => expect(card()).toHaveLength(1))
  })

  it('keeps the card while the assignment comment is open (the selector is hidden then)', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.assigned] }
    renderPanel({ commentInfoState: { open: true, driverId: 3 } })
    expect(section().querySelector('.odt-assign')).toBeNull()
    expect(card()).toHaveLength(2)
    expect(within(section()).getByText('Dan Quincy Driver Smith')).toBeInTheDocument()
    expect(within(section()).getAllByRole('button', { name: 'Call Dan' })).toHaveLength(1)
  })

  it('names the driver as main did: middle name and second last name included', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.other] }
    renderPanel()
    // redesign F6h: the name is a <bdi> inside the card's name element
    expect((await within(section()).findByText('Dan Quincy Driver Smith')).closest('.odt-party-name')).not.toBeNull()
  })
})

describe('Edit customer: the four labels are one element and one class (Q2-21)', () => {
  it('draws Cellphone, Email, Address and Notes as a <label class="odt-field-label"> tied to its field, in the same wrapper', () => {
    runtime.configs = { google_maps_api_key: { value: 'key' } }
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Customer' }))
    const fields = [...document.querySelectorAll('.odt-edit > .odt-field')]
    expect(fields).toHaveLength(4)
    for (const field of fields) {
      expect(field.tagName).toBe('DIV')
      const label = field.querySelector(':scope > label')
      expect(label).toHaveClass('odt-field-label')
      expect(label.getAttribute('for')).toBeTruthy()
      expect(document.getElementById(label.getAttribute('for'))).not.toBeNull()
    }
    expect(fields.map(field => field.querySelector('label').textContent)).toEqual(['Phone / Mobile', 'Email', 'Address', 'Notes'])
    expect(screen.getByLabelText('Phone / Mobile')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })
})

describe('Open as page: a content width, so rows and icons line up (Q2-24)', () => {
  const CSS = readFileSync(resolve(__dirname, '../../OrderDetails/details-tab.css'), 'utf8')
  const BRAND = readFileSync(resolve(process.cwd(), 'src/brand/candidates.css'), 'utf8')
  const wide = CSS.match(/@media \(min-width: 768px\) \{[\s\S]*?\n\}/g).join('\n')

  it('caps the Details content of the expanded panel at one content width, from the brand candidates', () => {
    expect(wide).toMatch(/\.odc-od\[data-expanded\] \.odc-od-body > \.odt-tab\s*\{[^}]*max-inline-size:\s*var\(--od-x-page-content\)/)
    expect(BRAND).toMatch(/--od-x-page-content:\s*\d+px/)
  })

  it('caps the driver select, not its head: the phone icon ends the row where the other icons do', () => {
    expect(wide).toMatch(/\.odc-od\[data-expanded\] \.odt-assign > :not\(\.odt-assign-head\)[^{]*\{[^}]*max-inline-size:\s*var\(--od-x-dialog-md\)/)
    expect(wide).not.toMatch(/\.odc-od\[data-expanded\] \.odt-assign\s*[,{]/)
  })

  it('draws the driver label and its phone in one head row, ahead of the select', async () => {
    runtime.driversList = { loading: false, drivers: [drivers.assigned] }
    renderPanel()
    await waitFor(() => expect(card()).toHaveLength(1))
    const head = section().querySelector('.odt-assign > .odt-assign-head')
    expect(head).not.toBeNull()
    expect(within(head).getByRole('button', { name: 'Call Dan' })).toBeInTheDocument()
    expect(head.nextElementSibling).not.toBeNull()
  })
})
