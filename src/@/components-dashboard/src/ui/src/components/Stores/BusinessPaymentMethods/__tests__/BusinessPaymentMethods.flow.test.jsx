/* eslint-disable import/first */
// redesign stores 1.B, adapted to the Payment methods section on P/SectionSplit (stores 5.9, ): the section with a
// stand-in controller that keeps `changesState` like the real one (BusinessPaymethods), and the REAL forms (PaymentOption and Square on
// ProviderPanel), so they run their own effects.
// - G4-03: opening another gateway with the detail open mounts a fresh form (nothing of A shows or is saved in B).
// - G4-20: the tab of A is not carried to B, and closing removes `paymethod_tab` (and `paymethod`) from the URL.
// - G4-26: the tutorial mounts the section without `setIsExtendExtraOpen`; opening a detail from a switch must not throw.
// - G4-02: Square opens (it used to run the customer-checkout controller, which threw on `body.paymethod_id`) and its
//   fields and Save use the section's controller (since 5.10b, ProviderPanel and `handleSavePaymethod`).
// - 4.A (decision 11): «Install» only for level 0, and only after a Confirm.
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const mocks = vi.hoisted(() => ({ saves: [], creates: [], toggles: [], installs: [], user: { level: 0 } }))

vi.mock('../../../../../../index', async () => {
  const ReactModule = await import('react')
  // stable like the real controller's state between renders (the forms reset their tab when sitesState changes)
  const SITES_STATE = { loading: false, sites: [{ id: 1, name: 'Web' }, { id: 2, name: 'App' }] }
  const DEVICE_STATE = { loading: false, devices: [{ id: 9, name: 'Front till' }] }
  const PAYSTACK = { id: 20, name: 'Paystack', gateway: 'paystack', data_template: null }
  const FakeBusinessPaymethods = (props) => {
    const [changesState, setChangesState] = ReactModule.useState({})
    const [businessPaymethodsState, setBusinessPaymethodsState] = ReactModule.useState({ loading: false, paymethods: props.fixture.businessPaymethods })
    const [installed, setInstalled] = ReactModule.useState(false)
    const { UIComponent } = props
    const paymethods = installed ? [...props.fixture.paymethods, PAYSTACK] : props.fixture.paymethods
    const create = (id, enabled) => {
      const created = { id: 100 + id, paymethod_id: id, enabled, sites: [], allowed_order_types: [1, 2, 3, 4, 5] }
      setBusinessPaymethodsState(prev => ({ ...prev, paymethods: [...prev.paymethods, created] }))
      return created
    }
    return ReactModule.createElement(UIComponent, {
      ...props,
      businessPaymethodsState,
      paymethodsList: { loading: false, paymethods },
      sitesState: SITES_STATE,
      deviceState: DEVICE_STATE,
      pluginsState: { loading: false, plugins: [] },
      actionState: { loading: false, result: { error: false } },
      changesState,
      cleanChangesState: (values) => setChangesState({ ...values }),
      handleChangeBusinessPaymentState: (values) => setChangesState(prev => ({ ...prev, ...values })),
      handleSavePaymethod: async (id, changes) => {
        mocks.saves.push({ id, changes })
        return { ok: true }
      },
      handleTogglePaymethod: async (id, enabled) => {
        mocks.toggles.push([id, enabled])
        const found = businessPaymethodsState.paymethods.find(item => item.paymethod_id === id)
        if (found) return { ok: true, result: found }
        const created = create(id, enabled)
        return { ok: true, result: created, created }
      },
      handleClickPayment: (id, callback) => {
        mocks.creates.push(id)
        const created = create(id, false)
        callback && callback(created)
      },
      handleInstallPaymentPlugin: async (pluginKey) => {
        mocks.installs.push(pluginKey)
        setInstalled(true)
        return pluginKey
      },
      handleDeleteBusinessPaymethodOption: () => {},
      setIsSuccessDeleted: () => {},
      handleSelectAllPaymethods: () => {},
      handleSuccessPaymethodUpdate: () => {}
    })
  }
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useConfig: () => [{ configs: {} }],
    useSession: () => [{ user: mocks.user }],
    useApi: () => [{}],
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Error: 'error' },
    BusinessPaymethods: FakeBusinessPaymethods,
    // what main wired Square to: the customer-checkout controller, which reads `body.paymethod_id`
    PaymentOptionSquare: (props) => props.body.paymethod_id,
    PaymentOptionStripeLink: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, props),
    BusinessWalletsList: () => null
  }
})
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../../hooks/useUserSelectedAccess', () => ({ useSelectedAccessRole: () => false }))

import { BusinessPaymentMethods } from '../index'

const CASH = { id: 1, name: 'Cash', gateway: 'cash', data_template: null }
const TERMINAL = { id: 3, name: 'Stripe Terminal', gateway: 'stripe_terminal', data_template: null }
const SQUARE = { id: 4, name: 'Square', gateway: 'square', data_template: null }
const GIFTME = { id: 5, name: 'Giftme', gateway: 'giftme', data_template: null }

const fixture = () => ({
  paymethods: [CASH, TERMINAL, SQUARE, GIFTME],
  businessPaymethods: [
    { id: 31, paymethod_id: 1, enabled: true, sandbox: false, sites: [{ id: 1, name: 'Web' }], allowed_order_types: [1], paymethod: CASH },
    { id: 33, paymethod_id: 3, enabled: true, sandbox: false, sites: [], allowed_order_types: [1, 2, 3, 4, 5], paymethod: TERMINAL },
    { id: 34, paymethod_id: 4, enabled: false, sandbox: false, sites: [], allowed_order_types: [1, 2], data: { application_id: 'sq-app', location_id: 'sq-loc' }, paymethod: SQUARE }
  ]
})

const draw = (props = {}, initialEntries) => renderWithProviders(
  <BusinessPaymentMethods business={{ id: 7 }} fixture={fixture()} setIsExtendExtraOpen={() => {}} {...props} />,
  { theme, ...(initialEntries && { initialEntries }) }
)

const open = (name) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}, View details`) }))
const panel = () => document.querySelector('.odc-pm-detail')
const selectedTab = (root) => within(root).queryAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')

beforeEach(() => {
  mocks.user = { level: 0 }
  mocks.saves.length = 0
  mocks.creates.length = 0
  mocks.toggles.length = 0
  mocks.installs.length = 0
  window.history.replaceState(null, '', '/stores/list?id=7&section=payment_methods')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('Payment methods · another gateway gets a fresh form (G4-03)', () => {
  it('Channels of B do not keep A\'s «only some sites»', () => {
    draw()
    open('Cash')
    expect(within(panel()).getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'false')
    open('Stripe Terminal')
    expect(screen.getByRole('heading', { level: 3, name: 'Stripe Terminal' })).toBeInTheDocument()
    expect(within(panel()).getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'true')
  })

  // adapted (5.9): the panel sends only what changed, so B's Save needs a change of its own; what must hold is that B starts from B's
  // order types (all five) and that nothing edited in A reaches the request
  it('Save in B sends B\'s order types, not the ones edited in A', () => {
    draw()
    open('Cash')
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Order type' }))
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Pickup' }))
    open('Stripe Terminal')
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Order type' }))
    for (const name of ['Delivery', 'Pickup', 'Eatin', 'Curbside', 'Driver thru']) {
      expect(within(panel()).getByRole('checkbox', { name })).toHaveAttribute('aria-checked', 'true')
    }
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Delivery' }))
    fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }))
    expect(mocks.saves).toHaveLength(1)
    expect(mocks.saves[0].id).toBe(33)
    expect(mocks.saves[0].changes).toEqual({ allowed_order_types: [2, 3, 4, 5] })
  })
})

describe('Payment methods · tabs and URL (G4-20)', () => {
  it('B opens on a tab it has, not on A\'s Devices', () => {
    draw()
    open('Cash')
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Devices' }))
    expect(within(panel()).getByRole('checkbox', { name: 'Front till' })).toBeInTheDocument()
    expect(window.location.search).toMatch(/paymethod_tab=2/)
    open('Stripe Terminal')
    expect(within(panel()).queryByRole('tab', { name: 'Devices' })).not.toBeInTheDocument()
    expect(selectedTab(panel())).toBeTruthy()
    expect(window.location.search).not.toMatch(/paymethod_tab=2/)
  })

  it('a tab from a deep link opens the linked gateway there, but not the next one', () => {
    const link = '/stores/list?id=7&section=payment_methods&paymethod=1&paymethod_tab=2'
    window.history.replaceState(null, '', link)
    draw({}, [link])
    expect(within(panel()).getByRole('tab', { name: 'Devices' })).toHaveAttribute('aria-selected', 'true')
    open('Square')
    expect(panel().querySelector('.odc-pp-panel[data-gateway="square"]')).not.toBeNull()
    expect(within(panel()).getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('closing removes paymethod and paymethod_tab from the URL', () => {
    draw()
    open('Cash')
    fireEvent.click(within(panel()).getByRole('tab', { name: 'Order type' }))
    expect(window.location.search).toMatch(/paymethod_tab=1/)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(panel()).toBeNull()
    expect(window.location.search).not.toMatch(/paymethod/)
  })
})

describe('Payment methods · tutorial (G4-26)', () => {
  it('a first click on a gateway does not throw without setIsExtendExtraOpen', async () => {
    const user = userEvent.setup()
    draw({ setIsExtendExtraOpen: undefined })
    await user.click(screen.getByRole('switch', { name: 'Giftme' }))
    await waitFor(() => expect(mocks.toggles).toEqual([[5, true]]))
    expect(screen.getByRole('switch', { name: 'Giftme' })).toHaveAttribute('aria-checked', 'true')
  })

  // Square's record has no keys here: turning it on opens its detail (decision 6)
  it('a switch that opens the detail does not throw either', async () => {
    const user = userEvent.setup()
    const withoutKeys = fixture()
    withoutKeys.businessPaymethods[2] = { ...withoutKeys.businessPaymethods[2], data: null }
    draw({ fixture: withoutKeys, setIsExtendExtraOpen: undefined })
    await user.click(screen.getByRole('switch', { name: 'Square' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Square' })).toBeInTheDocument()
    expect(panel().querySelector('.odc-pp-panel[data-gateway="square"]')).not.toBeNull()
  })
})

describe('Payment methods · Square (G4-02)', () => {
  it('opens, shows the stored keys and saves through the section controller', async () => {
    const user = userEvent.setup()
    draw()
    open('Square')
    const detail = panel()
    // D-16: no «Connect with Square» (it never had a handler)
    expect(within(detail).queryByRole('button', { name: 'Connect with Square' })).toBeNull()
    const live = within(detail).getByRole('group', { name: 'Live credentials' })
    expect(within(live).getByLabelText('Application Id')).toHaveValue('sq-app')
    await user.type(within(live).getAllByLabelText('Client secret').find(node => node.tagName === 'INPUT'), 'sq-secret')
    await user.click(within(detail).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.saves).toHaveLength(1))
    expect(mocks.saves[0].id).toBe(34)
    expect(mocks.saves[0].changes).toEqual({ data: { application_id: 'sq-app', location_id: 'sq-loc', client_secret: 'sq-secret' } })
  })

  it('lives in the panel: the section\'s title, no title or X of its own', () => {
    draw()
    open('Square')
    const square = panel().querySelector('.odc-pp-panel[data-gateway="square"]')
    expect(square).not.toBeNull()
    expect(panel().querySelector('h1')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 3, name: 'Square' })).toHaveLength(1)
  })
})

// redesign stores 4.A (decision 11): installing a payment plugin is for the whole project, so only level 0 is
// offered «Install». In main every level that reached the section saw the catalog rows and could send POST /plugins.
describe('Payment methods · «Install» is for level 0 (decision 11)', () => {
  it('level 0 sees the catalog rows with «Install»', () => {
    draw()
    expect(screen.getAllByRole('button', { name: 'Install' }).length).toBeGreaterThan(0)
  })

  it('level 2 does not, and still opens, edits and saves the methods the store has', () => {
    mocks.user = { level: 2 }
    draw()
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Cash, View details/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Stripe Terminal, View details/ })).toBeInTheDocument()
    open('Cash')
    expect(screen.getByRole('heading', { level: 3, name: 'Cash' })).toBeInTheDocument()
    // adapted (5.9): Save waits for a change; «All» channels is one
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'All' }))
    fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }))
    expect(mocks.saves.at(-1)).toMatchObject({ id: 31, changes: { sites: [] } })
  })

  it('asks before installing: Cancel installs nothing, Install installs the plugin and opens its editor', async () => {
    const user = userEvent.setup()
    draw()
    const paystack = screen.getByText('Paystack').closest('li')
    await user.click(within(paystack).getByRole('button', { name: 'Install' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Install payment method')).toBeInTheDocument()
    expect(within(dialog).getByText('This installs Paystack for the whole project. You can enable it for this store after that.')).toBeInTheDocument()
    expect(mocks.installs).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.installs).toEqual([])

    await user.click(within(screen.getByText('Paystack').closest('li')).getByRole('button', { name: 'Install' }))
    dialog = await screen.findByRole('alertdialog')
    expect(mocks.installs).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Install' }))
    await waitFor(() => expect(mocks.installs).toEqual(['paystack']))
    expect(await screen.findByRole('heading', { level: 3, name: 'Paystack' })).toBeInTheDocument()
    expect(mocks.creates).toEqual([20])
  })
})
