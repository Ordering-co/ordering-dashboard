/* eslint-disable import/first */
// redesign fix-qa E6: the parity items of the customer / business / driver sections that main had
// and the redesign dropped (closed orders keep the driver and company selectors, a pickup keeps
// its address, "On behalf of" keeps its label) plus the edit form (Cancel, labelled fields, no
// empty block where there is no map).
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const config = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} data-testid='autocomplete' />,
  GoogleMapsMap: props => <div data-testid='map' data-fill={props.fillContainer ? 'true' : undefined} />,
  useConfig: () => [config],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))

vi.mock('../../../../utils', () => ({ getUserType: () => false }))

vi.mock('../../DriverSelector', () => ({ DriverSelector: () => <div data-testid='driver-selector' /> }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => <div data-testid='company-selector' /> }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const baseOrder = {
  id: 42,
  status: 1,
  delivery_type: 1,
  business: { name: 'Restaurant' },
  customer: {
    id: 7,
    name: 'Ada',
    lastname: 'Lovelace',
    cellphone: '5552000',
    email: 'ada@example.test',
    address: '200 Customer Street',
    address_notes: 'Ring twice',
    zipcode: '10001',
    location: { lat: 40.5, lng: -73.9 }
  }
}

const makeProps = (order = {}, extra = {}) => ({
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn(),
  order: { ...baseOrder, ...order },
  ...extra
})

beforeEach(() => {
  config.configs = { addon_delivery_companies: { value: '1' }, google_maps_api_key: { value: 'key' } }
  window.google = { maps: { Map: function Map () {} } }
})

afterEach(() => {
  delete window.google
})

describe('closed orders keep the driver and company selectors (main had no status condition)', () => {
  it.each([[1], [2], [5], [11], [15]])('status %i, no driver: both selectors are there', (status) => {
    renderWithProviders(<OrderContactInformation {...makeProps({ status })} />)
    expect(screen.getByTestId('driver-selector')).toBeInTheDocument()
    expect(screen.getByTestId('company-selector')).toBeInTheDocument()
  })

  it('an open order keeps them too', () => {
    renderWithProviders(<OrderContactInformation {...makeProps({ status: 7 })} />)
    expect(screen.getByTestId('driver-selector')).toBeInTheDocument()
  })
})

describe('pickup (type 2) keeps what main showed', () => {
  const pickup = { delivery_type: 2 }

  it('shows address, coordinates, notes, zipcode and the customer preference', () => {
    renderWithProviders(<OrderContactInformation {...makeProps({ ...pickup, delivery_option: { name: 'Meet at door' } })} />)
    expect(screen.getByText('200 Customer Street')).toBeInTheDocument()
    expect(screen.getByText('40.5, -73.9')).toBeInTheDocument()
    expect(screen.getByText('Ring twice')).toBeInTheDocument()
    expect(screen.getByText('Zipcode: 10001')).toBeInTheDocument()
    expect(screen.getByText('Delivery preference: Meet at door')).toBeInTheDocument()
  })

  it('shows no driver block (a pickup has no driver)', () => {
    renderWithProviders(<OrderContactInformation {...makeProps(pickup)} />)
    expect(screen.queryByTestId('driver-selector')).toBeNull()
  })

  it('type 9 is the only type without the preference', () => {
    renderWithProviders(<OrderContactInformation {...makeProps({ delivery_type: 9 })} />)
    expect(screen.queryByText(/Delivery preference/)).toBeNull()
    expect(screen.getByText('200 Customer Street')).toBeInTheDocument()
  })
})

describe('On behalf of keeps its label', () => {
  it('names who the order was placed for', () => {
    renderWithProviders(<OrderContactInformation {...makeProps({ on_behalf_of: 'Grace Hopper' })} />)
    expect(screen.getByText('On behalf of')).toBeInTheDocument()
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0)
  })

  it('has no such label for an ordinary order', () => {
    renderWithProviders(<OrderContactInformation {...makeProps()} />)
    expect(screen.queryByText('On behalf of')).toBeNull()
  })
})

describe('edit customer', () => {
  const openEdit = (props) => {
    renderWithProviders(<OrderContactInformation {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Customer' }))
  }

  it('has a Cancel that closes the form and discards what was typed', () => {
    const props = makeProps({}, { customerInfoState: { customer: { email: 'typed@example.test' }, loading: false } })
    openEdit(props)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit Customer' })).toHaveAttribute('aria-pressed', 'false')
    expect(props.handleUpdateCustomerInfo).not.toHaveBeenCalled()
    // what the controller holds goes back to the order's own value, and the picked address is dropped
    expect(props.handleChangeCustomerInfoState).toHaveBeenCalledWith({ email: 'ada@example.test' })
    expect(props.setAddressState).toHaveBeenCalledWith({})
  })

  it('pressing Edit again closes it as well', () => {
    openEdit(makeProps())
    fireEvent.click(screen.getByRole('button', { name: 'Edit Customer' }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('labels every field and uses no placeholder that looks like real data', () => {
    openEdit(makeProps())
    expect(screen.getByLabelText('Phone / Mobile')).toHaveValue('5552000')
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.test')
    expect(screen.getByLabelText('Notes')).toHaveValue('Ring twice')
    expect(screen.queryByPlaceholderText('(603) 555-0123')).toBeNull()
    expect(screen.queryByPlaceholderText('jane.cooper@example.com')).toBeNull()
    for (const field of screen.getAllByRole('textbox')) {
      expect(field.getAttribute('placeholder') ?? '').not.toMatch(/\d{3}|@/)
    }
  })

  it('Save is the primary button of the form and Cancel sits next to it', () => {
    openEdit(makeProps())
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveAttribute('data-variant', 'primary')
    expect(within(save.parentElement).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('Save still goes through handleUpdateCustomerInfo and closes the form', async () => {
    const props = makeProps()
    props.handleUpdateCustomerInfo = vi.fn().mockResolvedValue(undefined)
    openEdit(props)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect(props.handleUpdateCustomerInfo).toHaveBeenCalledTimes(1)
  })

  it('draws the map block when there is a Google key and Maps has loaded', () => {
    openEdit(makeProps())
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  // redesign fix-qa E9: the map took an inline absolute 70% x 50% box and spilled out of the panel over Cancel / Save
  it('asks the map to fill the box of the form, and Cancel / Save come after that box', () => {
    openEdit(makeProps())
    const map = screen.getByTestId('map')
    expect(map).toHaveAttribute('data-fill', 'true')
    const box = map.closest('.odt-edit-map')
    expect(box).not.toBeNull()
    const actions = screen.getByRole('button', { name: 'Save' }).closest('.odt-edit-actions')
    expect(box.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(box.contains(actions)).toBe(false)
  })

  it('without a Google key there is no map and no empty block in its place', () => {
    config.configs = {}
    openEdit(makeProps())
    expect(screen.queryByTestId('map')).toBeNull()
    expect(document.querySelector('.odt-edit-map')).toBeNull()
  })

  it('with a key but Google not loaded (blocked, offline) there is no empty block either', () => {
    delete window.google
    openEdit(makeProps())
    expect(screen.queryByTestId('map')).toBeNull()
    expect(document.querySelector('.odt-edit-map')).toBeNull()
  })

  it('draws the map as soon as Google finishes loading', async () => {
    delete window.google
    openEdit(makeProps())
    expect(screen.queryByTestId('map')).toBeNull()
    window.google = { maps: { Map: function Map () {} } }
    expect(await screen.findByTestId('map', {}, { timeout: 2000 })).toBeInTheDocument()
  })
})
