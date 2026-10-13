import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({
  user: { id: 1, level: 0 },
  configs: {},
  businessResponse: null,
  businessCalls: [],
  orderRows: [],
  userRows: [],
  recordError: null,
  ordersHang: false,
  handleMenuCollapse: null
}))

vi.mock('../../../../../contexts/ApiContext', () => {
  const request = {
    select: () => request,
    asDashboard: () => request,
    where: (where) => {
      request.lastWhere = where
      return request
    },
    get: (options) => {
      state.businessCalls.push({ where: request.lastWhere, options })
      return state.businessResponse()
    }
  }
  const ordering = {
    root: 'https://api.test/v400/en/demo',
    project: 'demo',
    setAccessToken: () => ordering,
    businesses: () => {
      request.lastWhere = null
      return request
    }
  }
  return { useApi: () => [ordering, { configurations: {} }] }
})
// Shorter than the real 5 s so the slow-project test runs fast
vi.mock('../../../../../utils/commandPaletteRecords', async (importOriginal) => ({
  ...await importOriginal(),
  RECORD_SEARCH_SLOW_MS: 600
}))
vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok', user: state.user, auth: true }]
}))
vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: state.configs }]
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../../index', async () => {
  const { CommandPalette } = await import('../../../../../components/CommandPalette')
  return {
    CommandPalette,
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useAssistant: () => ({ setOpen: vi.fn() })
  }
})
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: state.handleMenuCollapse }]
}))
vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1280, height: 800 })
}))

import { CommandPalette, CommandPaletteTrigger } from '../index'
import { CommandPaletteProvider, CommandPaletteRouteBoundary, useCommandPalette } from '../../../contexts/CommandPaletteContext'

const settingsCatalog = [
  { id: 10, key: 'key_basic', parent_category_id: null, configs: [] },
  {
    id: 11,
    key: 'stripe',
    name: 'Stripe',
    parent_category_id: 10,
    configs: [{ key: 'stripe_publishable', name: 'Stripe publishable key' }]
  }
]

let mounts = 0
const PageProbe = () => {
  React.useEffect(() => { mounts += 1 }, [])
  return null
}

const renderPalette = ({ path = '/home' } = {}) => {
  const user = userEvent.setup()
  const utils = renderWithProviders(
    <CommandPaletteProvider enabled>
      <CommandPaletteTrigger />
      <MiaTrigger />
      <CommandPaletteRouteBoundary><PageProbe /></CommandPaletteRouteBoundary>
      <Route path='*' render={({ location }) => <output data-testid='location'>{location.pathname + location.search}</output>} />
      <CommandPalette />
    </CommandPaletteProvider>,
    { initialEntries: [path] }
  )
  return { user, ...utils }
}

const openWithShortcut = () => {
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
  return screen.findByTestId('command-palette')
}

const location = () => screen.getByTestId('location').textContent

const MiaTrigger = () => {
  const { open } = useCommandPalette()
  return <button onClick={() => open({ destinationId: 'action:business-schedule', fromAssistant: true })}>Mia store picker</button>
}

describe('CommandPalette', () => {
  it('opens the shared store picker focused on Mia’s canonical destination and retains keyboard navigation', async () => {
    const { user } = renderPalette()
    await user.click(screen.getByRole('button', { name: 'Mia store picker' }))
    const dialog = await screen.findByTestId('command-palette')
    expect(await within(dialog).findByText('Pizza Planet')).toBeInTheDocument()
    const input = within(dialog).getByRole('combobox')
    await waitFor(() => expect(input).toHaveFocus())
    await user.type(input, 'pizza')
    expect(input).toHaveValue('pizza')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toContain('section=schedule'))
    expect(location()).toContain('id=1')
  })
  beforeAll(() => {
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
    global.ResizeObserver = global.ResizeObserver || class { observe () {} unobserve () {} disconnect () {} }
  })

  beforeEach(() => {
    mounts = 0
    window.localStorage.clear()
    state.user = { id: 1, level: 0 }
    state.configs = {}
    state.businessCalls = []
    state.handleMenuCollapse = vi.fn()
    state.businessResponse = () => Promise.resolve({ content: { error: false, result: [{ id: 1, name: 'Pizza Planet', enabled: true }, { id: 2, name: 'Pizza Closed', enabled: false }] } })
    state.orderRows = []
    state.userRows = []
    state.recordError = null
    state.ordersHang = false
    global.fetch = vi.fn((url) => {
      if (state.ordersHang && String(url).includes('/orders?') && !String(url).includes('"conector":"AND"')) return new Promise(() => {})
      if (state.recordError && String(url).includes(state.recordError)) {
        return Promise.resolve({ json: () => Promise.resolve({ error: true, result: ['Server error'] }) })
      }
      if (String(url).includes('/orders?')) return Promise.resolve({ json: () => Promise.resolve({ error: false, result: state.orderRows }) })
      if (String(url).includes('/users?')) return Promise.resolve({ json: () => Promise.resolve({ error: false, result: state.userRows }) })
      const result = String(url).includes('/config_categories')
        ? settingsCatalog
        : String(url).includes('/third_party_integrations')
          ? [{ id: 1, name: 'Simphony', type: 'pos' }]
          : String(url).includes('/driver_companies')
            ? [{ id: 67, name: 'Shipday' }]
            : []
      return Promise.resolve({ json: () => Promise.resolve({ error: false, result }) })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens with the shortcut, shows suggestions and navigates with the keyboard', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    expect(within(dialog).getByText('Suggestions')).toBeInTheDocument()
    const input = within(dialog).getByRole('combobox')
    await user.type(input, 'clientes')
    expect((await within(dialog).findAllByText('Customers')).length).toBeGreaterThan(0)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toBe('/users/customers'))
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  it('closes with Escape and gives focus back to the trigger', async () => {
    const { user } = renderPalette()
    const trigger = screen.getByTestId('command-palette-trigger')
    await user.click(trigger)
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('opens a Settings field in the hub with focus', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/config_categories'), expect.anything()))
    await user.type(within(dialog).getByRole('combobox'), 'stripe publishable')
    await user.click(await within(dialog).findByText('Stripe publishable key'))
    await waitFor(() => expect(location()).toBe('/settings?group=payments&category=stripe&focus=stripe_publishable'))
  })

  it('searches stores on the server and opens the detail', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'pizza')
    expect(await within(dialog).findByText('Pizza Planet')).toBeInTheDocument()
    expect(within(dialog).getByText('Inactive')).toBeInTheDocument()
    expect(state.businessCalls[state.businessCalls.length - 1].options.query.page_size).toBe(8)
    await user.click(within(dialog).getByText('Pizza Planet'))
    await waitFor(() => expect(location()).toBe('/stores/list?id=1'))
  })

  it('keeps local results and offers a retry when the store search fails', async () => {
    state.businessResponse = () => Promise.reject(new Error('offline'))
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'stores')
    expect(await within(dialog).findByText('Retry')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Stores').length).toBeGreaterThan(0)
    state.businessResponse = () => Promise.resolve({ content: { error: false, result: [] } })
    await user.click(within(dialog).getByText('Retry'))
    // Shown in the list and announced once in the live region
    expect(await within(dialog).findAllByText('No stores match “stores”')).toHaveLength(2)
    expect(within(dialog).getByRole('status')).toHaveTextContent('No stores match “stores”')
  })

  it('asks for a store before opening a store section', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    const input = within(dialog).getByRole('combobox')
    await user.type(input, 'horario')
    await user.click(await within(dialog).findByText('Schedule'))
    expect(within(dialog).getByRole('button', { name: /Back: Schedule/ })).toBeInTheDocument()
    await waitFor(() => expect(input).toHaveFocus())
    expect(location()).toBe('/home')
    expect(await within(dialog).findByText('Pizza Planet')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(within(dialog).queryByRole('button', { name: /Back: Schedule/ })).not.toBeInTheDocument()
    await user.type(input, 'horario')
    await user.click(await within(dialog).findByText('Schedule'))
    await user.click(await within(dialog).findByText('Pizza Planet'))
    await waitFor(() => expect(location()).toBe('/stores/list?id=1&section=schedule'))
  })

  it('opens a store that arrived after typing with Enter', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    const input = within(dialog).getByRole('combobox')
    await user.type(input, 'horario')
    await user.click(await within(dialog).findByText('Schedule'))
    expect(await within(dialog).findByText('Pizza Planet')).toBeInTheDocument()
    state.businessResponse = () => Promise.resolve({ content: { error: false, result: [{ id: 15, name: 'Panera', enabled: true }] } })
    await user.type(input, 'panera')
    expect(await within(dialog).findByText('Panera')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).queryByText('Pizza Planet')).not.toBeInTheDocument())
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toBe('/stores/list?id=15&section=schedule'))
  })

  it('keeps the hand-offs to Orders and Users', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'ana')
    expect(await within(dialog).findByText('Search “ana” in Orders')).toBeInTheDocument()
    await user.click(within(dialog).getByText('Search “ana” in Users'))
    await waitFor(() => expect(location()).toBe('/users/customers?q=ana'))
  })

  it('finds an order by number and opens its detail', async () => {
    state.orderRows = [
      { id: 98765, status: 0, customer: { name: 'Ana', lastname: 'Ruiz' }, business: { name: 'Pizza Planet' } },
      { id: 1234, status: 1, customer: { name: 'Leo' }, business: { name: 'Taco Dos' } }
    ]
    state.businessResponse = () => Promise.resolve({ content: { error: false, result: [] } })
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), '1234')
    expect(await within(dialog).findByText('Order #1234')).toBeInTheDocument()
    const orderCall = global.fetch.mock.calls.map(([url]) => String(url)).find(url => url.includes('/orders?'))
    expect(orderCall).toContain('mode=dashboard')
    expect(orderCall).toContain('"attribute":"id","value":1234')
    // Exact number first
    const titles = within(dialog).getAllByText(/^Order #/).map(node => node.textContent)
    expect(titles).toEqual(['Order #1234', 'Order #98765'])
    // A number that matches no store does not add a "No stores" row
    await waitFor(() => expect(state.businessCalls.length).toBeGreaterThan(0))
    expect(within(dialog).queryByText(/No stores match/)).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toBe('/orders?id=1234'))
  })

  it('finds a user by phone and opens it in its listing', async () => {
    state.userRows = [
      { id: 7, name: 'Ana', lastname: 'Ruiz', email: 'ana@test.com', cellphone: '5512345678', country_phone_code: '52', level: 3, enabled: true },
      { id: 8, name: 'Beto', lastname: 'Paz', cellphone: '5512340000', level: 4, enabled: true }
    ]
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), '+52 55 1234')
    expect(await within(dialog).findByText('Ana Ruiz')).toBeInTheDocument()
    expect(within(dialog).getByText('Customer · ana@test.com · +52 5512345678')).toBeInTheDocument()
    const userCall = global.fetch.mock.calls.map(([url]) => String(url)).find(url => url.includes('/users?'))
    expect(decodeURIComponent(userCall)).toContain('"attribute":"cellphone","value":{"condition":"ilike","value":"%52551234%"}')
    // "Search in" points at the types found, each with its own listing
    expect(within(dialog).getByText('Search “+52 55 1234” in Customers')).toBeInTheDocument()
    expect(within(dialog).getByText('Search “+52 55 1234” in Drivers')).toBeInTheDocument()
    expect(within(dialog).queryByText('Search “+52 55 1234” in Users')).not.toBeInTheDocument()
    await user.click(within(dialog).getByText('Beto Paz'))
    await waitFor(() => expect(location()).toBe('/delivery/drivers-list?id=8'))
  })

  it('keeps working when the order search fails', async () => {
    state.recordError = '/orders?'
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), '1234')
    expect(await within(dialog).findByText('Couldn’t search orders. Pages and settings still work.')).toBeInTheDocument()
    expect(within(dialog).getByText('Search “1234” in Orders')).toBeInTheDocument()
  })

  it('does not search users for store owners', async () => {
    state.user = { id: 2, level: 2 }
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), '1234')
    await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/orders?'))).toBe(true))
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/users?'))).toBe(false)
  })

  it('searches orders by customer name on regular projects', async () => {
    state.orderRows = [{ id: 501, status: 0, customer: { name: 'Ana', lastname: 'López' }, business: { name: 'Pizza Planet' } }]
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'ana lopez')
    expect(await within(dialog).findByText('Order #501')).toBeInTheDocument()
    const orderCall = decodeURIComponent(global.fetch.mock.calls.map(([url]) => String(url)).find(url => url.includes('/orders?')))
    expect(orderCall).toContain('"attribute":"customer"')
  })

  it('switches a slow project to number-only order search and remembers it', async () => {
    state.ordersHang = true
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'ana')
    expect((await within(dialog).findAllByText(/This project has many orders/, {}, { timeout: 3000 })).length).toBeGreaterThan(0)
    expect(JSON.parse(window.localStorage.getItem('command_palette_slow_search:demo'))).toHaveProperty('orders')
    // The hand-off to the Orders listing is still there
    expect(within(dialog).getByText('Search “ana” in Orders')).toBeInTheDocument()
  }, 8000)

  it('only looks up order numbers on a project marked slow', async () => {
    window.localStorage.setItem('command_palette_slow_search:demo', JSON.stringify({ orders: Date.now() }))
    state.orderRows = [{ id: 1234, status: 1, customer: { name: 'Leo' }, business: { name: 'Taco Dos' } }]
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    const input = within(dialog).getByRole('combobox')
    await user.type(input, 'ana lopez')
    expect((await within(dialog).findAllByText(/This project has many orders/)).length).toBeGreaterThan(0)
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/orders?'))).toBe(false)
    await user.clear(input)
    await user.type(input, '1234')
    expect(await within(dialog).findByText('Order #1234')).toBeInTheDocument()
    const orderCall = global.fetch.mock.calls.map(([url]) => String(url)).find(url => url.includes('/orders?'))
    expect(orderCall.split('where=')[1]).toBe('{"conditions":[{"attribute":"id","value":1234}],"conector":"AND"}')
    expect(orderCall).not.toContain('orderBy')
  })

  it('finds integrations loaded from the API', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    const input = within(dialog).getByRole('combobox')
    await user.type(input, 'shipday')
    await user.click(await within(dialog).findByText('Shipday'))
    await waitFor(() => expect(location()).toBe('/connect/delivery-services?id=67'))
  })

  it('asks for a store before opening a POS integration', async () => {
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'simphony')
    await user.click(await within(dialog).findByText('Simphony'))
    await user.click(await within(dialog).findByText('Pizza Planet'))
    await waitFor(() => expect(location()).toBe('/connect/pos-menu?id=1'))
  })

  it('respects a restricted role', async () => {
    state.user = { id: 2, level: 2 }
    const { user } = renderPalette()
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'ana')
    expect(await within(dialog).findByText('Search “ana” in Orders')).toBeInTheDocument()
    expect(within(dialog).queryByText('Search “ana” in Users')).not.toBeInTheDocument()
    // Owners only see POS & Menu Sync in Connect: no Settings catalog, no delivery companies
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/config_categories'), expect.anything())
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/driver_companies'), expect.anything())
  })

  it('remounts the page when opening a destination on the current page', async () => {
    const { user } = renderPalette({ path: '/stores/list?id=3' })
    expect(mounts).toBe(1)
    const dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'pizza')
    await user.click(await within(dialog).findByText('Pizza Planet'))
    await waitFor(() => expect(location()).toBe('/stores/list?id=1'))
    expect(mounts).toBe(2)
  })

  it('remembers recent destinations', async () => {
    const { user } = renderPalette()
    let dialog = await openWithShortcut()
    await user.type(within(dialog).getByRole('combobox'), 'clientes')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toBe('/users/customers'))
    await act(async () => {})
    dialog = await openWithShortcut()
    expect(within(dialog).getByText('Recent')).toBeInTheDocument()
  })
})
