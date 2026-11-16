/* eslint-disable import/first */
// redesign stores 5.9: the Payment methods LIST on P/SectionSplit. The forms on ProviderPanel (PaymentOption, PaymentOptionConfig,
// PaymentOptionGlobal, PaymentOptionMethods and, from 5.10a, Stripe direct, Stripe link and Mercado Pago) and seven of the eight
// provider forms of the same family are stand-ins that record their props, so this spec does not depend on their insides; the real Paypal form
// (on ProviderPanel since 5.10a) is kept to see a provider form in the panel (its own tabs and save bar, no header of its own). The controller
// is a stateful stand-in with the new handlers (`handleTogglePaymethod`, `handleSavePaymethod`, `handleSelectAllPaymethods`).
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const mocks = vi.hoisted(() => {
  const state = {
    width: 1440,
    user: { level: 0 },
    configs: {},
    selectedAccess: false,
    guard: null,
    calls: {},
    formProps: {},
    connect: () => {},
    successUpdate: () => {}
  }
  // a stand-in for a provider form: records its props, registers the close guard `mocks.guard` and offers a Save that calls `onSave`
  state.makeStandIn = (React, name, useSectionSplit) => function StandIn (props) {
    const { registerCloseGuard } = useSectionSplit()
    state.formProps[name] = props
    React.useEffect(() => registerCloseGuard(proceed => (state.guard ? state.guard(proceed) : false)), [registerCloseGuard])
    return React.createElement(
      'div',
      { 'data-testid': `form-${name}` },
      React.createElement('button', { type: 'button', onClick: () => props.onSave?.({ sandbox: true }) }, `Save ${name}`)
    )
  }
  return state
})

vi.mock('../../../../../../index', async () => {
  const ReactModule = await import('react')
  // stable like the real controller's state between renders
  const SITES_STATE = { loading: false, sites: [{ id: 1, name: 'Web' }, { id: 2, name: 'App' }] }
  const DEVICE_STATE = { loading: false, devices: [{ id: 9, name: 'Front till' }] }
  const FakeBusinessPaymethods = (props) => {
    const { UIComponent, fixture } = props
    const [records, setRecords] = ReactModule.useState(() => fixture.records.map(record => ({ ...record })))
    const [isSuccessDeleted, setIsSuccessDeleted] = ReactModule.useState(false)
    const paymethodOf = (id) => fixture.paymethods.find(paymethod => paymethod.id === id)
    const create = (id, enabled) => {
      const created = { id: 100 + id, paymethod_id: id, enabled, sandbox: false, sites: [], allowed_order_types: [1, 2, 3, 4, 5], data: null, paymethod: paymethodOf(id) }
      setRecords(previous => [...previous, created])
      return created
    }
    const track = (kind, ...args) => { (mocks.calls[kind] = mocks.calls[kind] || []).push(args) }
    return ReactModule.createElement(UIComponent, {
      ...props,
      businessPaymethodsState: { loading: !!fixture.loading, paymethods: records },
      paymethodsList: { loading: !!fixture.loading, paymethods: fixture.paymethods },
      sitesState: SITES_STATE,
      deviceState: DEVICE_STATE,
      pluginsState: { loading: false, plugins: [] },
      actionState: { loading: false, result: { error: false } },
      changesState: {},
      handleStripeConnect: mocks.connect,
      cleanChangesState: () => {},
      handleChangeBusinessPaymentState: () => {},
      handleSuccessPaymethodUpdate: () => {},
      handleSuccessUpdate: mocks.successUpdate,
      isSuccessDeleted,
      setIsSuccessDeleted,
      handleClickPayment: (id, callback) => {
        track('click', id)
        callback?.(create(id, false))
      },
      // redesign bugs C: a gateway is created by its first Save
      getDraftBusinessPaymethod: (id) => ({ draft: true, paymethod_id: id, paymethod: paymethodOf(id), enabled: false, sandbox: false, data: null, data_sandbox: null, sites: [], devices: [] }),
      handleCreatePaymethodOnSave: async (id, changes, options) => {
        track('createOnSave', id, changes, options)
        if (fixture.createOnSaveResult) return fixture.createOnSaveResult
        create(id, false)
        // the record was created but the changes on it were not saved (the PUT failed)
        if (fixture.createOnSavePartial) return { ok: false, error: ['Boom'] }
        return { ok: true }
      },
      handleTogglePaymethod: async (id, enabled) => {
        track('toggle', id, enabled)
        if (fixture.toggleResult) return fixture.toggleResult
        const found = records.find(record => record.paymethod_id === id)
        if (found) {
          setRecords(previous => previous.map(record => (record.paymethod_id === id ? { ...record, enabled } : record)))
          return { ok: true, result: { ...found, enabled } }
        }
        const created = create(id, enabled)
        return { ok: true, result: created, created }
      },
      // redesign stores 5.11: the options too (R2 of 5.9: the panel's saves are silent)
      handleSavePaymethod: async (id, changes, options) => {
        track('save', id, changes, options)
        return { ok: true }
      },
      handleSaveStripeConnect: async (id, changes) => {
        track('saveConnect', id, changes)
        return { ok: true }
      },
      handleSelectAllPaymethods: async (ids) => {
        track('selectAll', ids)
        return { ok: true, okCount: ids.length, failCount: 0 }
      },
      handleDeleteBusinessPaymethodOption: async (paymethodId) => {
        track('delete', paymethodId)
        setRecords(previous => previous.filter(record => record.paymethod_id !== paymethodId))
        setIsSuccessDeleted(true)
        return { ok: true }
      }
    })
  }
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: mocks.user }],
    useApi: () => [{}],
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Error: 'error' },
    BusinessPaymethods: FakeBusinessPaymethods
  }
})
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: mocks.width, height: 900 }) }))
vi.mock('../../../../hooks/useUserSelectedAccess', () => ({ useSelectedAccessRole: () => mocks.selectedAccess }))

// the four forms rewritten to the new props contract
vi.mock('../../PaymentOption', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOption: mocks.makeStandIn(React, 'PaymentOption', useSectionSplit) }
})
vi.mock('../../PaymentOptionConfig', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionConfig: mocks.makeStandIn(React, 'PaymentOptionConfig', useSectionSplit) }
})
vi.mock('../../PaymentOptionGlobal', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionGlobal: mocks.makeStandIn(React, 'PaymentOptionGlobal', useSectionSplit) }
})
vi.mock('../../PaymentOptionMethods', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionMethods: mocks.makeStandIn(React, 'PaymentOptionMethods', useSectionSplit) }
})
// seven of the eight provider forms of 5.10a / 5.10b / 5.11 (the real Paypal stays)
vi.mock('../../PaymentOptionStripeDirect', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionStripeDirect: mocks.makeStandIn(React, 'PaymentOptionStripeDirect', useSectionSplit) }
})
vi.mock('../../PaymentOptionStripeLink', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionStripeLink: mocks.makeStandIn(React, 'PaymentOptionStripeLink', useSectionSplit) }
})
// main,
vi.mock('../../PaymentOptionStripeConnectV2', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionStripeConnectV2: mocks.makeStandIn(React, 'PaymentOptionStripeConnectV2', useSectionSplit) }
})
vi.mock('../../PaymethodOptionStripeConnect', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymethodOptionStripeConnect: mocks.makeStandIn(React, 'PaymethodOptionStripeConnect', useSectionSplit) }
})
vi.mock('../../PaymentOptionSquare', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionSquare: mocks.makeStandIn(React, 'PaymentOptionSquare', useSectionSplit) }
})
vi.mock('../../PaymentOptionCredomatic', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionCredomatic: mocks.makeStandIn(React, 'PaymentOptionCredomatic', useSectionSplit) }
})
vi.mock('../../PaymentOptionMercadoPago', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionMercadoPago: mocks.makeStandIn(React, 'PaymentOptionMercadoPago', useSectionSplit) }
})
vi.mock('../../PaymentOptionEpayco', async () => {
  const React = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product')
  return { PaymentOptionEpayco: mocks.makeStandIn(React, 'PaymentOptionEpayco', useSectionSplit) }
})

import { BusinessPaymentMethods } from '../index'

const FULL_CONFIGS = Object.fromEntries([
  'stripe_publishable', 'stripe_publishable_sandbox', 'stripe_secret', 'stripe_secret_sandbox',
  'global_apple_pay_publishable', 'global_apple_pay_publishable_sandbox', 'global_apple_pay_secret', 'global_apple_pay_secret_sandbox',
  'global_google_pay_publishable', 'global_google_pay_publishable_sandbox', 'global_google_pay_secret', 'global_google_pay_secret_sandbox',
  'computop_merchant_id', 'computop_blowfish_password', 'computop_hmac_password'
].map(key => [key, { value: 'x' }]))

const CASH = { id: 1, name: 'Cash', gateway: 'cash', data_template: null }
const PAGAZUL = { id: 2, name: 'Pagazul', gateway: 'pagazul', data_template: [{ key: 'api_key', required: true }, { key: 'note' }] }
const TERMINAL = { id: 3, name: 'Stripe Terminal', gateway: 'stripe_terminal', data_template: null }
const SQUARE = { id: 4, name: 'Square', gateway: 'square', data_template: null }
const PAYPAL = { id: 5, name: 'Paypal', gateway: 'paypal', data_template: null }
const STRIPE = { id: 6, name: 'Stripe', gateway: 'stripe', data_template: null }
const GLOBAL_GOOGLE = { id: 7, name: 'Global Google Pay', gateway: 'global_google_pay', data_template: null }
const GOOGLE_PAY = { id: 8, name: 'Google Pay', gateway: 'google_pay', data_template: null }
const CONNECT = { id: 9, name: 'Stripe Connect', gateway: 'stripe_connect', data_template: null }
const BRAINTREE = { id: 10, name: 'Braintree', gateway: 'braintree', data_template: null }
const MERCADO = { id: 11, name: 'Mercado Pago', gateway: 'checkout_pro_mercadopago', data_template: null }
const CARD = { id: 12, name: 'Card on delivery', gateway: 'card_delivery', data_template: null }
const CONNECT_V2 = { id: 13, name: 'Stripe Connect v2', gateway: 'stripe_connect_v2', data_template: null } // main

const PAYMETHODS = [CASH, PAGAZUL, TERMINAL, SQUARE, PAYPAL, STRIPE, GLOBAL_GOOGLE, GOOGLE_PAY, CONNECT, BRAINTREE, MERCADO, CARD]

const record = (paymethod, extra = {}) => ({
  id: 30 + paymethod.id,
  paymethod_id: paymethod.id,
  enabled: true,
  sandbox: false,
  sites: [],
  allowed_order_types: [1, 2],
  data: null,
  ...extra
})

const baseRecords = () => [
  record(CASH),
  record(PAGAZUL, { enabled: false, data: { api_key: 'k' } }),
  record(TERMINAL)
]

const draw = ({ records = baseRecords(), paymethods = PAYMETHODS, ...fixture } = {}, props = {}, initialEntries) => renderWithProviders(
  <BusinessPaymentMethods
    business={{ id: 7, name: 'My store' }}
    fixture={{ records, paymethods, ...fixture }}
    setIsExtendExtraOpen={() => {}}
    {...props}
  />,
  { theme, ...(initialEntries && { initialEntries }) }
)

const nameButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}, View details`) })
const switchOf = (name) => screen.getByRole('switch', { name })
const splitRoot = () => document.querySelector('.odc-section-split')

beforeEach(() => {
  mocks.width = 1440
  mocks.user = { level: 0 }
  mocks.configs = { ...FULL_CONFIGS }
  mocks.selectedAccess = false
  mocks.guard = null
  mocks.calls = {}
  mocks.formProps = {}
  mocks.connect = vi.fn()
  mocks.successUpdate = vi.fn()
  window.history.replaceState(null, '', '/stores/list?id=7&section=payment_methods')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('Payment methods list · rows', () => {
  it('draws a switch per gateway, a native button named by the gateway, reachable and operable with the keyboard', async () => {
    const user = userEvent.setup()
    draw()
    const pagazul = switchOf('Pagazul')
    expect(pagazul.tagName).toBe('BUTTON')
    expect(pagazul).toHaveAttribute('aria-checked', 'false')
    expect(switchOf('Cash')).toHaveAttribute('aria-checked', 'true')
    pagazul.focus()
    expect(pagazul).toHaveFocus()
    await user.keyboard('[Space]')
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[2, true]]))
    await waitFor(() => expect(switchOf('Pagazul')).toHaveAttribute('aria-checked', 'true'))
  })

  it('keeps the groups, the order and the names of main (credit card gateways under their own heading)', () => {
    draw()
    const main = screen.getByRole('list', { name: 'Payment methods' })
    expect(within(main).getAllByRole('switch').map(item => item.getAttribute('aria-label'))).toEqual([
      'Cash', 'Pagazul', 'Stripe Terminal', 'Square', 'Global Google Pay', 'Stripe Connect', 'Braintree', 'Card on delivery'
    ])
    expect(screen.getByRole('heading', { level: 4, name: 'Credit card payments' })).toBeInTheDocument()
    const cards = screen.getByRole('list', { name: 'Credit card payments' })
    expect(within(cards).getAllByRole('switch').map(item => item.getAttribute('aria-label'))).toEqual([
      'Paypal', 'Stripe', 'Google Pay (with Stripe)'
    ])
  })

  it('the selected-access role sees only the Braintree rows and no credit card group', () => {
    mocks.selectedAccess = true
    draw()
    expect(screen.getAllByRole('switch').map(item => item.getAttribute('aria-label'))).toEqual(['Braintree'])
    expect(screen.queryByRole('heading', { name: 'Credit card payments' })).toBeNull()
  })

  it('the search filters by display name and says so when nothing matches', async () => {
    const user = userEvent.setup()
    draw()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'google')
    expect(screen.getAllByRole('switch').map(item => item.getAttribute('aria-label'))).toEqual(['Global Google Pay', 'Google Pay (with Stripe)'])
    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzz')
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('shows Sandbox and Keys missing on an enabled row, and nothing on a disabled one', () => {
    draw({
      records: [
        record(CASH),
        record(PAYPAL, { sandbox: true, data: null }),
        record(SQUARE, { enabled: false, sandbox: true })
      ]
    })
    const paypalRow = switchOf('Paypal').closest('li')
    expect(within(paypalRow).getByText('Sandbox')).toBeInTheDocument()
    expect(within(paypalRow).getByText('Keys missing')).toBeInTheDocument()
    expect(within(switchOf('Cash').closest('li')).queryByText('Sandbox')).toBeNull()
    expect(within(switchOf('Square').closest('li')).queryByText('Keys missing')).toBeNull()
    expect(within(switchOf('Square').closest('li')).queryByText('Sandbox')).toBeNull()
  })

  // owner decision 5 C (W1): the Sandbox gap shows on the enabled row; Live mode and complete Sandbox do not
  it('shows Keys missing on an enabled row in Sandbox mode with Live complete and a gap in Sandbox, and not otherwise', () => {
    const live = { client_id: 'a', secret: 'b' }
    draw({
      records: [
        record(CASH),
        record(PAYPAL, { sandbox: true, data: live, data_sandbox: { client_id: 'x', secret: '' } }),
        record(SQUARE, { sandbox: true, data: { application_id: 'a' }, data_sandbox: { application_id: 'x' } }),
        record(CONNECT, { sandbox: false, data: live, data_sandbox: {} })
      ]
    })
    const paypalRow = switchOf('Paypal').closest('li')
    expect(within(paypalRow).getByText('Sandbox')).toBeInTheDocument()
    expect(within(paypalRow).getByText('Keys missing')).toBeInTheDocument()
    expect(within(switchOf('Square').closest('li')).queryByText('Keys missing')).toBeNull()
    expect(within(switchOf('Stripe Connect').closest('li')).queryByText('Keys missing')).toBeNull()
  })

  it('a loading list is a busy region of skeleton rows, with nothing to press', () => {
    draw({ loading: true })
    const busy = screen.getByRole('status', { name: 'Loading' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
  })

  it('marks the open row with aria-current and gives each row the key the focus returns to', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Cash'))
    const cashRow = switchOf('Cash').closest('li')
    expect(cashRow).toHaveAttribute('aria-current', 'true')
    expect(cashRow).toHaveAttribute('data-section-split-key', '1')
    expect(switchOf('Pagazul').closest('li')).not.toHaveAttribute('aria-current')
  })
})

describe('Payment methods list · the switch', () => {
  it('Mercado Pago is listed when the add-on config exists, even with value 0 (S-8), and not when it is absent', () => {
    mocks.configs = { ...FULL_CONFIGS, mercadopago_sandbox_mode: { value: '0' } }
    const view = draw()
    expect(screen.getByRole('switch', { name: 'Mercado Pago' })).toBeInTheDocument()
    view.unmount()
    mocks.configs = { ...FULL_CONFIGS }
    draw()
    expect(screen.queryByRole('switch', { name: 'Mercado Pago' })).toBeNull()
  })

  it('refuses to turn off the last enabled gateway, with the notice under the switch', async () => {
    const user = userEvent.setup()
    draw({ records: [record(CASH)] })
    await user.click(switchOf('Cash'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The Payment methods must have at least one items.')
    expect(alert.closest('.odc-async-switch')).toContainElement(switchOf('Cash'))
    expect(mocks.calls.toggle).toBeUndefined()
    expect(switchOf('Cash')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a person who is not an admin cannot turn on a global gateway without the project keys', async () => {
    const user = userEvent.setup()
    mocks.user = { level: 2 }
    mocks.configs = {}
    draw()
    await user.click(switchOf('Stripe'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please contact administrator')
    expect(mocks.calls.toggle).toBeUndefined()
    expect(mocks.calls.click).toBeUndefined()
    expect(switchOf('Stripe')).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the API message under the switch when the save fails', async () => {
    const user = userEvent.setup()
    draw({ toggleResult: { ok: false, error: ['Boom from the API'] } })
    await user.click(switchOf('Pagazul'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom from the API')
    expect(switchOf('Pagazul')).toHaveAttribute('aria-checked', 'false')
  })

  it('turning off an active gateway asks first, and Cancel keeps it on', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(switchOf('Cash'))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Turn off Cash?')).toBeInTheDocument()
    expect(within(dialog).getByText('Customers stop seeing Cash at checkout. You can turn it on again later.')).toBeInTheDocument()
    expect(mocks.calls.toggle).toBeUndefined()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.calls.toggle).toBeUndefined()
    expect(switchOf('Cash')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Confirm turns it off with handleTogglePaymethod(id, false)', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(switchOf('Cash'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[1, false]]))
    await waitFor(() => expect(switchOf('Cash')).toHaveAttribute('aria-checked', 'false'))
  })

  it('a gateway without keys and without a record is created ON in one click (S-6)', async () => {
    const user = userEvent.setup()
    draw()
    expect(switchOf('Card on delivery')).toHaveAttribute('aria-checked', 'false')
    await user.click(switchOf('Card on delivery'))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[12, true]]))
    expect(mocks.calls.click).toBeUndefined()
    await waitFor(() => expect(switchOf('Card on delivery')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByTestId('form-PaymentOption')).toBeNull()
  })

  it('a gateway that needs keys and has no record is created OFF and its detail opens with the notice', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(switchOf('Paypal'))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[5, false]]))
    expect(await screen.findByRole('heading', { level: 3, name: 'Paypal' })).toBeInTheDocument()
    const detail = document.querySelector('.odc-pm-detail')
    expect(within(detail).getByText('Please fill all the data to activate the payment method (sandbox mode is opcional)')).toBeInTheDocument()
    expect(switchOf('Paypal')).toHaveAttribute('aria-checked', 'false')
    expect(window.location.search).toMatch(/paymethod=5/)
  })

  // redesign bugs F row 15: the toggle's POST was still pending when the person opened another gateway; the answer must
  // not pull the detail back to the toggled one
  it('F15: a gateway toggled to open its detail does not take the detail over if another one was opened while the POST was pending', async () => {
    const user = userEvent.setup()
    let release
    const pending = new Promise(resolve => { release = resolve })
    draw({ toggleResult: pending })
    await user.click(switchOf('Paypal'))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[5, false]]))
    await user.click(nameButton('Pagazul'))
    expect(await screen.findByTestId('form-PaymentOptionConfig')).toBeInTheDocument()
    release({ ok: true, created: { id: 105, paymethod_id: 5, enabled: false, sandbox: false, sites: [], allowed_order_types: [1], data: null, paymethod: PAYPAL } })
    await act(async () => { await pending })
    expect(screen.getByTestId('form-PaymentOptionConfig')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Paypal' })).toBeNull()
    expect(switchOf('Pagazul').closest('li')).toHaveAttribute('aria-current', 'true')
    expect(window.location.search).toMatch(/paymethod=2/)
  })

  it('turning on a gateway with a record but missing data opens its detail with the notice and does not turn it on', async () => {
    const user = userEvent.setup()
    draw({ records: [...baseRecords(), record(SQUARE, { enabled: false })] })
    await user.click(switchOf('Square'))
    expect(await screen.findByTestId('form-PaymentOptionSquare')).toBeInTheDocument()
    expect(screen.getByText('Please fill all the data to activate the payment method (sandbox mode is opcional)')).toBeInTheDocument()
    expect(mocks.calls.toggle).toBeUndefined()
    expect(switchOf('Square')).toHaveAttribute('aria-checked', 'false')
  })

  // owner decision 5 C (W1): Live is what blocks, as on main; a Sandbox gap only warns
  describe('Sandbox data gap', () => {
    const live = { client_id: 'a', secret: 'b' }

    it('turns on a gateway in Sandbox mode with Live complete and warns which Sandbox fields are missing', async () => {
      const user = userEvent.setup()
      draw({ records: [...baseRecords(), record(PAYPAL, { enabled: false, sandbox: true, data: live, data_sandbox: JSON.stringify({ client_id: 'x', secret: '' }) })] })
      await user.click(switchOf('Paypal'))
      await waitFor(() => expect(mocks.calls.toggle).toEqual([[5, true]]))
      await waitFor(() => expect(switchOf('Paypal')).toHaveAttribute('aria-checked', 'true'))
      expect(await screen.findByText('Missing in Sandbox: Secret')).toBeInTheDocument()
      expect(within(switchOf('Paypal').closest('li')).getByText('Keys missing')).toBeInTheDocument()
      expect(document.querySelector('.odc-pm-detail')).toBeNull()
    })

    it('names every field when data_sandbox is empty, and the notice goes away on the next switch', async () => {
      const user = userEvent.setup()
      draw({ records: [...baseRecords(), record(PAYPAL, { enabled: false, sandbox: true, data: live, data_sandbox: null })] })
      await user.click(switchOf('Paypal'))
      expect(await screen.findByText('Missing in Sandbox: Client ID, Secret')).toBeInTheDocument()
      await user.click(switchOf('Pagazul'))
      await waitFor(() => expect(screen.queryByText(/Missing in Sandbox/)).toBeNull())
    })

    it('does not warn in Live mode with an empty Sandbox', async () => {
      const user = userEvent.setup()
      draw({ records: [...baseRecords(), record(PAYPAL, { enabled: false, sandbox: false, data: live, data_sandbox: {} })] })
      await user.click(switchOf('Paypal'))
      await waitFor(() => expect(switchOf('Paypal')).toHaveAttribute('aria-checked', 'true'))
      expect(screen.queryByText(/Missing in Sandbox/)).toBeNull()
      expect(within(switchOf('Paypal').closest('li')).queryByText('Keys missing')).toBeNull()
    })

    it('still opens the detail with the notice and does not turn on when Live is missing, in Sandbox mode too', async () => {
      const user = userEvent.setup()
      draw({ records: [...baseRecords(), record(PAYPAL, { enabled: false, sandbox: true, data: { client_id: '', secret: 'b' }, data_sandbox: { client_id: 'x', secret: 'y' } })] })
      await user.click(switchOf('Paypal'))
      expect(await screen.findByText('Please fill all the data to activate the payment method (sandbox mode is opcional)')).toBeInTheDocument()
      expect(mocks.calls.toggle).toBeUndefined()
      expect(switchOf('Paypal')).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByText(/Missing in Sandbox/)).toBeNull()
    })
  })
  // redesign bugs C: a gateway with no field of its own (null template, in no list) turns on with one click, like cash
  it('a gateway with no fields turns on from the list at once, with or without a record, and its detail asks for nothing', async () => {
    const user = userEvent.setup()
    const LINK = { id: 14, name: 'Stripe Connect Link', gateway: 'stripe_connect_link', data_template: null }
    const view = draw({ paymethods: [...PAYMETHODS, LINK] })
    await user.click(switchOf('Stripe Connect Link'))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[14, true]]))
    expect(screen.queryByTestId('form-PaymentOption')).toBeNull()
    await waitFor(() => expect(switchOf('Stripe Connect Link')).toHaveAttribute('aria-checked', 'true'))
    view.unmount()

    mocks.calls = {}
    draw({ paymethods: [...PAYMETHODS, LINK], records: [...baseRecords(), record(LINK, { enabled: false })] })
    await user.click(switchOf('Stripe Connect Link'))
    await waitFor(() => expect(mocks.calls.toggle).toEqual([[14, true]]))
    await user.click(nameButton('Stripe Connect Link'))
    expect(await screen.findByTestId('form-PaymentOption')).toBeInTheDocument()
    expect(screen.queryByText('Payment method data is incomplete, make sure to configure correctly')).toBeNull()
    expect(screen.queryByText('Please fill all the data to activate the payment method (sandbox mode is opcional)')).toBeNull()
  })

  it('an enabled gateway with incomplete data says so at the top of its detail', async () => {
    const user = userEvent.setup()
    draw({ records: [...baseRecords(), record(SQUARE, { enabled: true, data: { application_id: '' } })] })
    await user.click(nameButton('Square'))
    expect(await screen.findByText('Payment method data is incomplete, make sure to configure correctly')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Payment methods list · Select all', () => {
  it('is disabled when there is nothing to turn on', () => {
    draw({
      records: PAYMETHODS.filter(paymethod => paymethod.id !== MERCADO.id).map(paymethod => record(paymethod))
    })
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
  })

  it('asks first, counts what it turns on and warns about the ones without credentials', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    // Pagazul (has its data), Square, Global Google Pay, Stripe Connect, Braintree, Card on delivery, Paypal, Stripe, Google Pay
    expect(within(dialog).getByText('Turn on 9 payment methods?')).toBeInTheDocument()
    // Square, Stripe Connect, Paypal and Google Pay have no keys yet. Braintree here has a null template: no field to fill, so no keys
    // are missing (bugs C, ; main counted it)
    expect(within(dialog).getByText('Customers will see them at checkout. 4 of them have no credentials yet: orders paid with them can fail.')).toBeInTheDocument()
    expect(mocks.calls.selectAll).toBeUndefined()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.calls.selectAll).toBeUndefined()
  })

  it('leaves out the missing-credentials sentence when every target has its keys', async () => {
    const user = userEvent.setup()
    draw({ paymethods: [CASH, PAGAZUL, TERMINAL, CARD], records: baseRecords() })
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Turn on 2 payment methods?')).toBeInTheDocument()
    expect(within(dialog).queryByText(/no credentials yet/)).toBeNull()
  })

  it('Confirm sends only the ids of the rows the list shows and are off, and not a hidden Mercado Pago', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Turn on 9' }))
    await waitFor(() => expect(mocks.calls.selectAll).toHaveLength(1))
    const ids = mocks.calls.selectAll[0][0]
    expect([...ids].sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 7, 8, 9, 10, 12])
    expect(ids).not.toContain(MERCADO.id)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('the box does not narrow it (as before) and catalog rows are never targets', async () => {
    const user = userEvent.setup()
    draw({ paymethods: [CASH, CARD], records: [record(CASH)] })
    expect(screen.getAllByRole('button', { name: 'Install' }).length).toBeGreaterThan(0)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'cash')
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Turn on 1' }))
    await waitFor(() => expect(mocks.calls.selectAll).toEqual([[[12]]]))
  })

  it('a row the role cannot see (global Google Pay for the selected-access role) is not turned on', async () => {
    const user = userEvent.setup()
    mocks.selectedAccess = true
    draw({ records: [record(BRAINTREE, { enabled: false })] })
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Turn on 1' }))
    await waitFor(() => expect(mocks.calls.selectAll).toEqual([[[10]]]))
    expect(mocks.calls.selectAll[0][0]).not.toContain(GLOBAL_GOOGLE.id)
  })

  it('a person who is not an admin does not turn on a global gateway without keys', async () => {
    const user = userEvent.setup()
    mocks.user = { level: 2 }
    mocks.configs = {}
    draw({ paymethods: [CASH, STRIPE, GLOBAL_GOOGLE, CARD], records: [record(CASH)] })
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Turn on 1' }))
    await waitFor(() => expect(mocks.calls.selectAll).toEqual([[[12]]]))
  })
})

describe('Payment methods list · the detail', () => {
  it.each([
    ['cash', 'Cash', 'PaymentOption'],
    ['stripe_terminal', 'Stripe Terminal', 'PaymentOption'],
    ['google_pay', 'Google Pay \\(with Stripe\\)', 'PaymentOptionMethods'],
    ['stripe', 'Stripe', 'PaymentOptionGlobal'],
    ['global_google_pay', 'Global Google Pay', 'PaymentOptionGlobal'],
    ['pagazul', 'Pagazul', 'PaymentOptionConfig'],
    ['square', 'Square', 'PaymentOptionSquare'],
    ['stripe_connect', 'Stripe Connect', 'PaymethodOptionStripeConnect']
  ])('%s opens %s in %s', async (gateway, name, form) => {
    const user = userEvent.setup()
    const paymethod = PAYMETHODS.find(item => item.gateway === gateway)
    draw({ records: [...baseRecords().filter(item => item.paymethod_id !== paymethod.id), record(paymethod, { enabled: false })] })
    await user.click(nameButton(name))
    expect(await screen.findByTestId(`form-${form}`)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="form-"]')).toHaveLength(1)
  })

  it('passes the new contract to the four rewritten forms', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Cash'))
    const props = mocks.formProps.PaymentOption
    expect(props.paymethod).toMatchObject({ id: 1, gateway: 'cash' })
    expect(props.businessPaymethod).toMatchObject({ id: 31, paymethod_id: 1 })
    expect(props.gatewayName).toBe('Cash')
    expect(props.storeName).toBe('My store')
    expect(props.sites).toEqual([{ id: 1, name: 'Web' }, { id: 2, name: 'App' }])
    expect(props.devices).toEqual([{ id: 9, name: 'Front till' }])
    expect(props.orderTypes.map(type => type.value)).toEqual([1, 2, 3, 4, 5, 7, 8, 9])
    expect(props.initialTab).toBeUndefined()
    expect(props.business).toMatchObject({ id: 7 })
    await user.click(screen.getByRole('button', { name: 'Save PaymentOption' }))
    expect(mocks.calls.save).toEqual([[31, { sandbox: true }, { silent: true }]])
  })

  it('reads the tab of the link when the detail mounts and writes the tab the user picks', async () => {
    const link = '/stores/list?id=7&section=payment_methods&paymethod=1&paymethod_tab=2'
    window.history.replaceState(null, '', link)
    draw({}, {}, [link])
    await screen.findByTestId('form-PaymentOption')
    expect(mocks.formProps.PaymentOption.initialTab).toBe(2)
    mocks.formProps.PaymentOption.onTabChange(1)
    expect(window.location.search).toMatch(/paymethod_tab=1/)
  })

  // main, Stripe Connect v2 has a form of its own (not the generic one) and brings no keys
  it('stripe_connect_v2 opens Stripe Connect v2 in PaymentOptionStripeConnectV2', async () => {
    const user = userEvent.setup()
    draw({ paymethods: [...PAYMETHODS, CONNECT_V2], records: [...baseRecords(), record(CONNECT_V2, { enabled: false })] })
    await user.click(nameButton('Stripe Connect v2'))
    expect(await screen.findByTestId('form-PaymentOptionStripeConnectV2')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="form-"]')).toHaveLength(1)
    expect(mocks.formProps.PaymentOptionStripeConnectV2.business).toMatchObject({ id: 7 })
  })

  // main, a tab of a gateway's own (Stripe Connect v2) is never kept in the URL: the form sends null
  it('drops the tab from the URL when the form reports a tab of its own (null)', async () => {
    const link = '/stores/list?id=7&section=payment_methods&paymethod=1&paymethod_tab=2'
    window.history.replaceState(null, '', link)
    draw({}, {}, [link])
    await screen.findByTestId('form-PaymentOption')
    mocks.formProps.PaymentOption.onTabChange(null)
    expect(window.location.search).not.toMatch(/paymethod_tab/)
    expect(window.location.search).toMatch(/paymethod=1/)
  })

  it('opening another gateway drops the tab and mounts a fresh form', async () => {
    const user = userEvent.setup()
    const link = '/stores/list?id=7&section=payment_methods&paymethod=1&paymethod_tab=2'
    window.history.replaceState(null, '', link)
    draw({}, {}, [link])
    await screen.findByTestId('form-PaymentOption')
    await user.click(nameButton('Pagazul'))
    expect(await screen.findByTestId('form-PaymentOptionConfig')).toBeInTheDocument()
    expect(screen.queryByTestId('form-PaymentOption')).toBeNull()
    expect(mocks.formProps.PaymentOptionConfig.initialTab).toBeUndefined()
    expect(window.location.search).not.toMatch(/paymethod_tab/)
    expect(window.location.search).toMatch(/paymethod=2/)
  })

  it('closing removes paymethod and paymethod_tab from the URL', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Cash'))
    mocks.formProps.PaymentOption.onTabChange(1)
    expect(window.location.search).toMatch(/paymethod=1.*paymethod_tab=1|paymethod_tab=1.*paymethod=1/)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('form-PaymentOption')).toBeNull())
    expect(window.location.search).not.toMatch(/paymethod/)
  })

  it('opening another row goes through the leave guard of the open form', async () => {
    const user = userEvent.setup()
    const proceeds = []
    mocks.guard = (proceed) => { proceeds.push(proceed); return true }
    draw()
    await user.click(nameButton('Cash'))
    await screen.findByTestId('form-PaymentOption')
    await user.click(nameButton('Pagazul'))
    expect(proceeds).toHaveLength(1)
    expect(screen.getByTestId('form-PaymentOption')).toBeInTheDocument()
    expect(screen.queryByTestId('form-PaymentOptionConfig')).toBeNull()
    mocks.guard = null
    act(() => { proceeds[0]() })
    expect(await screen.findByTestId('form-PaymentOptionConfig')).toBeInTheDocument()
  })

  // redesign bugs C (decision 4 of Stores): main created a disabled record the moment a gateway was opened
  it('opening a gateway without a record writes nothing: its detail starts from a draft, with no Delete', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Square'))
    expect(await screen.findByTestId('form-PaymentOptionSquare')).toBeInTheDocument()
    expect(mocks.formProps.PaymentOptionSquare.businessPaymethod).toMatchObject({ draft: true, paymethod_id: 4, enabled: false })
    expect(mocks.calls.click).toBeUndefined()
    expect(mocks.calls.toggle).toBeUndefined()
    expect(mocks.calls.createOnSave).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(window.location.search).toMatch(/paymethod=4/)
    expect(switchOf('Square')).toHaveAttribute('aria-checked', 'false')
  })

  it('the first Save of that draft creates the gateway with the changes; then it is a record like any other', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Square'))
    await screen.findByTestId('form-PaymentOptionSquare')
    await user.click(screen.getByRole('button', { name: 'Save PaymentOptionSquare' }))
    expect(mocks.calls.createOnSave).toEqual([[4, { sandbox: true }, { stripeConnect: false }]])
    expect(mocks.calls.save).toBeUndefined()
    await waitFor(() => expect(mocks.formProps.PaymentOptionSquare.businessPaymethod).toMatchObject({ id: 104, paymethod_id: 4 }))
    expect(mocks.formProps.PaymentOptionSquare.businessPaymethod.draft).toBeUndefined()
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save PaymentOptionSquare' }))
    expect(mocks.calls.save).toEqual([[104, { sandbox: true }, { silent: true }]])
    expect(mocks.calls.createOnSave).toHaveLength(1)
  })

  // review: the record exists but the changes did not land; the form stays mounted and the next Save sends them on that record
  it('when the first Save creates the gateway but its changes fail, the form stays and Try again saves them on the new record', async () => {
    const user = userEvent.setup()
    draw({ createOnSavePartial: true })
    await user.click(nameButton('Square'))
    const form = await screen.findByTestId('form-PaymentOptionSquare')
    await user.click(screen.getByRole('button', { name: 'Save PaymentOptionSquare' }))
    expect(mocks.calls.createOnSave).toHaveLength(1)
    await waitFor(() => expect(mocks.formProps.PaymentOptionSquare.businessPaymethod).toMatchObject({ id: 104 }))
    // the same form element: what was typed is still there
    expect(screen.getByTestId('form-PaymentOptionSquare')).toBe(form)
    await user.click(screen.getByRole('button', { name: 'Save PaymentOptionSquare' }))
    expect(mocks.calls.save).toEqual([[104, { sandbox: true }, { silent: true }]])
    expect(mocks.calls.createOnSave).toHaveLength(1)
  })

  it('Stripe Connect\'s first Save goes with its own save', async () => {
    const user = userEvent.setup()
    draw({ records: baseRecords() })
    await user.click(nameButton('Stripe Connect'))
    await screen.findByTestId('form-PaymethodOptionStripeConnect')
    await user.click(screen.getByRole('button', { name: 'Save PaymethodOptionStripeConnect' }))
    expect(mocks.calls.createOnSave).toEqual([[9, { sandbox: true }, { stripeConnect: true }]])
  })

  it('a deep link to a gateway without a record opens its draft and writes nothing either', async () => {
    const link = '/stores/list?id=7&section=payment_methods&paymethod=4'
    window.history.replaceState(null, '', link)
    draw({}, {}, [link])
    expect(await screen.findByTestId('form-PaymentOptionSquare')).toBeInTheDocument()
    expect(mocks.formProps.PaymentOptionSquare.businessPaymethod).toMatchObject({ draft: true, paymethod_id: 4 })
    expect(mocks.calls.click).toBeUndefined()
    expect(mocks.calls.createOnSave).toBeUndefined()
  })

  it('closing the draft without saving leaves nothing behind', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Square'))
    await screen.findByTestId('form-PaymentOptionSquare')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('form-PaymentOptionSquare')).toBeNull())
    expect(mocks.calls).toEqual({})
  })

  it('a provider form lives in the panel: its own tabs and save bar, the section\'s own title and no h1 of its own', async () => {
    const user = userEvent.setup()
    draw({ records: [...baseRecords(), record(PAYPAL, { enabled: false, data: {} })] })
    await user.click(nameButton('Paypal'))
    const detail = await waitFor(() => {
      const node = document.querySelector('.odc-pm-detail')
      expect(node).not.toBeNull()
      return node
    })
    expect(detail.querySelector('.odc-pp-panel[data-gateway="paypal"]')).not.toBeNull()
    expect(detail.querySelector('h1')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 3, name: 'Paypal' })).toHaveLength(1)
  })

  // redesign stores 5.10a and 5.10b: these go through `renderProviderForm`, not the legacy branch
  it.each([
    ['paypal', 'Paypal'],
    ['stripe_checkout', 'Stripe Direct'],
    ['stripe_link', 'Stripe Link'],
    ['checkout_pro_mercadopago', 'Mercado Pago'],
    ['square', 'Square'],
    ['credomatic', 'Credomatic'],
    ['epayco', 'Epayco']
  ])('%s (%s) gets the ProviderPanel contract, not inPanel', async (gateway, name) => {
    const user = userEvent.setup()
    mocks.configs = { ...FULL_CONFIGS, mercadopago_sandbox_mode: { value: '0' } }
    const paymethods = [
      ...PAYMETHODS,
      { id: 13, name: 'Stripe Direct', gateway: 'stripe_checkout', data_template: null },
      { id: 14, name: 'Stripe Link', gateway: 'stripe_link', data_template: null },
      { id: 15, name: 'Credomatic', gateway: 'credomatic', data_template: null },
      { id: 16, name: 'Epayco', gateway: 'epayco', data_template: null }
    ]
    const paymethod = paymethods.find(item => item.gateway === gateway)
    draw({ paymethods, records: [...baseRecords(), record(paymethod, { enabled: false })] })
    await user.click(nameButton(name))
    if (gateway === 'paypal') {
      expect(await screen.findByRole('tablist', { name: 'Paypal' })).toBeInTheDocument()
      return
    }
    const standIn = {
      stripe_checkout: 'PaymentOptionStripeDirect',
      stripe_link: 'PaymentOptionStripeLink',
      checkout_pro_mercadopago: 'PaymentOptionMercadoPago',
      square: 'PaymentOptionSquare',
      credomatic: 'PaymentOptionCredomatic',
      epayco: 'PaymentOptionEpayco'
    }[gateway]
    await screen.findByTestId(`form-${standIn}`)
    const props = mocks.formProps[standIn]
    expect(props.inPanel).toBeUndefined()
    expect(props.paymethod).toMatchObject({ gateway })
    expect(props.businessPaymethod).toMatchObject({ paymethod_id: paymethod.id })
    expect(props.gatewayName).toBe(name)
    expect(props.storeName).toBe('My store')
    expect(props.sites).toEqual([{ id: 1, name: 'Web' }, { id: 2, name: 'App' }])
    expect(props.orderTypes.map(type => type.value)).toEqual([1, 2, 3, 4, 5, 7, 8, 9])
    expect(props.changesState).toBeUndefined()
    expect(props.handleSaveClick).toBeUndefined()
    // Stripe Link's controller calls this when it saves a Twilio config; nobody else gets it
    expect(props.handleSuccessUpdate).toBe(gateway === 'stripe_link' ? mocks.successUpdate : undefined)
    await user.click(screen.getByRole('button', { name: new RegExp(`^Save ${standIn}$`) }))
    expect(mocks.calls.save).toEqual([[30 + paymethod.id, { sandbox: true }, { silent: true }]])
  })

  it.each([
    [800, 'stack'],
    [900, 'stack'],
    [1000, 'split'],
    [1100, 'split'],
    [1440, 'split']
  ])('at %ipx the section is %s (splitFrom is 1000)', (width, mode) => {
    mocks.width = width
    draw()
    expect(splitRoot()).toHaveAttribute('data-mode', mode)
  })

  it('below 1000 the detail replaces the list with a Back button; from 1000 they sit side by side with an X', async () => {
    const user = userEvent.setup()
    mocks.width = 900
    const view = draw()
    await user.click(nameButton('Cash'))
    await screen.findByTestId('form-PaymentOption')
    expect(splitRoot()).toHaveAttribute('data-view', 'detail')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.queryByTestId('form-PaymentOption')).toBeNull())
    view.unmount()
    mocks.width = 1100
    draw()
    await user.click(nameButton('Cash'))
    await screen.findByTestId('form-PaymentOption')
    expect(splitRoot()).toHaveAttribute('data-view', 'split')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  // redesign stores 5.18 (R5.8-02): stacked, a gateway opened low in the list starts at the top of its detail; side by side
  // nothing scrolls (P/SectionSplit's opt-in revealDetail)
  it('stacked, the opened gateway is scrolled to the top of its detail; side by side it is not', async () => {
    const scrolled = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) { scrolled.push([this.className, options]) }
    try {
      const user = userEvent.setup()
      mocks.width = 390
      const view = draw()
      await user.click(nameButton('Cash'))
      await screen.findByTestId('form-PaymentOption')
      await waitFor(() => expect(scrolled).toEqual([['odc-section-split-detail', { block: 'start' }]]))
      view.unmount()

      scrolled.length = 0
      mocks.width = 1440
      draw()
      await user.click(nameButton('Cash'))
      await screen.findByTestId('form-PaymentOption')
      await new Promise(resolve => requestAnimationFrame(resolve))
      expect(scrolled).toEqual([])
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  // redesign stores 5.11: Stripe Connect is on ProviderPanel. Same props at every width (G4-09), the OAuth window as
  // `onConnect` (never called on its own) and its own save, which posts the business fees apart
  it.each([900, 1440])('Stripe Connect gets the provider props at %ipx, saves with handleSaveStripeConnect and never connects on its own', async (width) => {
    const user = userEvent.setup()
    mocks.width = width
    draw({ records: [...baseRecords(), record(CONNECT, { enabled: false })] })
    await user.click(nameButton('Stripe Connect'))
    await screen.findByTestId('form-PaymethodOptionStripeConnect')
    const props = mocks.formProps.PaymethodOptionStripeConnect
    expect(props.inPanel).toBeUndefined()
    expect(props.changesState).toBeUndefined()
    expect(props.handleStripeConnect).toBeUndefined()
    expect(props.onConnect).toBe(mocks.connect)
    expect(props.businessPaymethod).toMatchObject({ paymethod_id: CONNECT.id })
    expect(props.business).toMatchObject({ id: 7 })
    await user.click(screen.getByRole('button', { name: 'Save PaymethodOptionStripeConnect' }))
    expect(mocks.calls.saveConnect).toEqual([[30 + CONNECT.id, { sandbox: true }]])
    expect(mocks.calls.save).toBeUndefined()
    expect(mocks.connect).not.toHaveBeenCalled()
  })
})

describe('Payment methods list · Delete in the header menu', () => {
  // N-1: main sent `businessPaymethod.paymethod.id`, which the API does not return (DELETE …/paymethods/undefined). The records here
  // carry no `paymethod` object, so only `paymethod_id` can be the id sent.
  it.each([
    ['generic', CASH, 'Cash'],
    ['template', PAGAZUL, 'Pagazul'],
    ['global', STRIPE, 'Stripe'],
    ['methods', GOOGLE_PAY, 'Google Pay \\(with Stripe\\)'],
    ['legacy', SQUARE, 'Square']
  ])('%s gateway: asks, then deletes by paymethod_id', async (_kind, paymethod, name) => {
    const user = userEvent.setup()
    draw({ records: [CASH, TERMINAL, paymethod].filter((item, index, all) => all.indexOf(item) === index).map(item => record(item)) })
    await user.click(nameButton(name))
    await screen.findByTestId(/^form-/)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(`Delete ${paymethod.id === GOOGLE_PAY.id ? 'Google Pay (with Stripe)' : paymethod.name}?`)).toBeInTheDocument()
    expect(within(dialog).getByText('Are you sure to delete this Paymethod?')).toBeInTheDocument()
    expect(mocks.calls.delete).toBeUndefined()
    await user.click(within(dialog).getByRole('button', { name: 'Delete payment method' }))
    await waitFor(() => expect(mocks.calls.delete).toEqual([[paymethod.id]]))
    // a successful delete closes the detail
    await waitFor(() => expect(screen.queryByTestId(/^form-/)).toBeNull())
    expect(window.location.search).not.toMatch(/paymethod=/)
  })

  it('Cancel deletes nothing', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(nameButton('Cash'))
    await screen.findByTestId('form-PaymentOption')
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.calls.delete).toBeUndefined()
    expect(screen.getByTestId('form-PaymentOption')).toBeInTheDocument()
  })
})
