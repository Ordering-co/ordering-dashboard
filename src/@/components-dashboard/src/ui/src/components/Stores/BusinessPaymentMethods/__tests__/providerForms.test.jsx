/* eslint-disable import/first */
// redesign stores 5.9: the four provider forms of My payment methods on ProviderPanel (PaymentOption, PaymentOptionConfig,
// PaymentOptionGlobal, PaymentOptionMethods). They are thin wrappers: these tests check what each one configures (tabs and the index
// `?paymethod_tab=` keeps from `main`, fields, secrets, the role filter, the Mercado Pago button, the Settings link) and one save each.
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const state = vi.hoisted(() => ({ level: 0, configs: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: state.level } }],
  useConfig: () => [{ configs: state.configs }],
  useApi: () => [{ project: 'acme' }],
  useToast: () => [{}, { showToast: () => {} }]
}))

vi.mock('../../../../utils/mercadoPagoConnect', async () => {
  const actual = await vi.importActual('../../../../utils/mercadoPagoConnect')
  return { ...actual, openMercadoPagoSetupPopup: vi.fn() }
})

import { openMercadoPagoSetupPopup } from '../../../../utils/mercadoPagoConnect'
import { PaymentOption } from '../../PaymentOption'
import { PaymentOptionConfig } from '../../PaymentOptionConfig'
import { PaymentOptionGlobal } from '../../PaymentOptionGlobal'
import { PaymentOptionMethods } from '../../PaymentOptionMethods'
import { SectionSplit } from '../../../Shared/Product/SectionSplit'

const ORDER_TYPES = [
  { value: 1, text: 'Delivery' },
  { value: 2, text: 'Pickup' },
  { value: 3, text: 'Eat in' }
]
const SITES = [{ id: 10, name: 'Web' }, { id: 11, name: 'App' }]
const DEVICES = [{ id: 20, name: 'Kiosk' }]

const record = (extra = {}) => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: {},
  data_sandbox: {},
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const setup = (Form, props = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  renderWithProviders(
    <Form
      gatewayName='Gateway'
      storeName='Burger Hub'
      sites={SITES}
      devices={DEVICES}
      orderTypes={ORDER_TYPES}
      business={{ id: 7 }}
      onSave={onSave}
      onTabChange={onTabChange}
      {...props}
    />,
    { theme }
  )
  return { user, onSave, onTabChange }
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent)
const input = (scope, name) => within(scope).getAllByLabelText(name).find(node => node.tagName === 'INPUT')

const replaceText = async (user, node, text) => {
  await user.clear(node)
  if (text) await user.type(node, text)
}

beforeEach(() => {
  state.level = 0
  state.configs = {}
  vi.mocked(openMercadoPagoSetupPopup).mockClear()
})

describe('PaymentOption (generic gateways)', () => {
  const props = (gateway = 'stripe_terminal', extra = {}) => ({
    paymethod: { id: 1, gateway, name: 'Gateway', data_template: null },
    businessPaymethod: record(),
    ...extra
  })

  it('offers Channels and Order type, with the indices of main (0 and 1), and no General', async () => {
    const { user, onTabChange } = setup(PaymentOption, props())
    expect(tabNames()).toEqual(['Channels', 'Order type'])
    expect(screen.queryByRole('button', { name: 'Sandbox' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(0)
  })

  it('opens Order type when the store has no sites', () => {
    setup(PaymentOption, props('stripe_terminal', { sites: [] }))
    expect(tabNames()).toEqual(['Order type'])
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
  })

  it('offers Devices (index 2) only for cash and card on delivery', async () => {
    const { user, onTabChange } = setup(PaymentOption, props('cash'))
    expect(tabNames()).toEqual(['Channels', 'Order type', 'Devices'])
    await user.click(screen.getByRole('tab', { name: 'Devices' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole('checkbox', { name: 'Kiosk' })).toBeInTheDocument()
  })

  it('card on delivery has Devices too, a stripe terminal does not', () => {
    const { unmount } = renderWithProviders(
      <PaymentOption {...props('card_delivery')} sites={SITES} devices={DEVICES} orderTypes={ORDER_TYPES} />,
      { theme }
    )
    expect(tabNames()).toContain('Devices')
    unmount()
    renderWithProviders(
      <PaymentOption {...props('stripe_terminal')} sites={SITES} devices={DEVICES} orderTypes={ORDER_TYPES} />,
      { theme }
    )
    expect(tabNames()).not.toContain('Devices')
  })

  it('honours initialTab', () => {
    setup(PaymentOption, props('cash', { initialTab: 2 }))
    expect(screen.getByRole('tab', { name: 'Devices' })).toHaveAttribute('aria-selected', 'true')
  })

  it('saves the order types that changed', async () => {
    const { user, onSave } = setup(PaymentOption, props('stripe_terminal', { initialTab: 1 }))
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1] })
  })

  it('saves a device picked in the Devices tab', async () => {
    const { user, onSave } = setup(PaymentOption, props('cash', { initialTab: 2 }))
    await user.click(screen.getByRole('checkbox', { name: 'Kiosk' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ devices: [20] })
  })
})

describe('PaymentOptionConfig (templated gateways)', () => {
  const TEMPLATE = [
    { key: 'merchant_name', name: 'merchant_name', type: 'text', required: true, description: 'Shown to customers' },
    { key: 'b_secret_key', name: 'b_secret_key', type: 'text', required: true },
    { key: 'marketplace_fee_percent', name: 'marketplace_fee_percent', type: 'text' }
  ]
  const props = (extra = {}) => ({
    paymethod: { id: 1, gateway: 'mercado_pago_checkout_pro', name: 'Mercado Pago', data_template: TEMPLATE },
    businessPaymethod: record({
      data: { merchant_name: 'Live shop', b_secret_key: 'mock_01_xxxxxx6789', marketplace_fee_percent: '5' },
      data_sandbox: { merchant_name: 'Test shop', b_secret_key: 'mock_02_xxxxxx6789', marketplace_fee_percent: '1' }
    }),
    ...extra
  })

  it('offers General (0), Channels (1) and Order type (2) and reports the main index', async () => {
    const { user, onTabChange } = setup(PaymentOptionConfig, props())
    expect(tabNames()).toEqual(['General', 'Channels', 'Order type'])
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
  })

  it('draws the fields of the active mode only, and follows the mode', async () => {
    const { user } = setup(PaymentOptionConfig, props())
    expect(screen.getAllByLabelText(/^merchant_name/)).toHaveLength(1)
    expect(screen.getByLabelText(/^merchant_name/)).toHaveValue('Live shop')
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(screen.getAllByLabelText(/^merchant_name/)).toHaveLength(1)
    expect(screen.getByLabelText(/^merchant_name/)).toHaveValue('Test shop')
  })

  it('shows the description of the field as its hint', () => {
    setup(PaymentOptionConfig, props())
    expect(screen.getByText('Shown to customers')).toBeInTheDocument()
  })

  it('hides a text-typed secret key behind Show, and shows a plain field', async () => {
    const { user } = setup(PaymentOptionConfig, props())
    const secret = input(document.body, /^b_secret_key/)
    expect(secret).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/^merchant_name/)).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /^Show/ }))
    expect(secret).toHaveAttribute('type', 'text')
  })

  it('hides marketplace_fee_percent from a level 2 user and shows it to a level 0 one', () => {
    state.level = 2
    const { unmount } = renderWithProviders(
      <PaymentOptionConfig {...props()} sites={SITES} devices={[]} orderTypes={ORDER_TYPES} business={{ id: 7 }} />,
      { theme }
    )
    expect(screen.queryByLabelText(/^marketplace_fee_percent/)).not.toBeInTheDocument()
    unmount()
    state.level = 0
    renderWithProviders(
      <PaymentOptionConfig {...props()} sites={SITES} devices={[]} orderTypes={ORDER_TYPES} business={{ id: 7 }} />,
      { theme }
    )
    expect(screen.getByLabelText(/^marketplace_fee_percent/)).toHaveValue('5')
  })

  it('has the Connect with Mercado Pago button, which opens the setup popup of the store', async () => {
    const { user } = setup(PaymentOptionConfig, props())
    await user.click(screen.getByRole('button', { name: 'Connect with Mercado Pago' }))
    expect(openMercadoPagoSetupPopup).toHaveBeenCalledTimes(1)
    expect(openMercadoPagoSetupPopup).toHaveBeenCalledWith(
      'https://mercado-pago-checkout-pro.plugins.orderingplus.com/acme/views/setup?business_id=7'
    )
  })

  it('has no Connect button in another gateway, and no Interswitch title anywhere', () => {
    setup(PaymentOptionConfig, props({ paymethod: { id: 2, gateway: 'interswitch', name: 'Interswitch', data_template: TEMPLATE } }))
    expect(screen.queryByRole('button', { name: 'Connect with Mercado Pago' })).not.toBeInTheDocument()
    expect(screen.queryByText('Interswitch')).not.toBeInTheDocument()
  })

  it('a required empty field blocks the save', async () => {
    const { user, onSave } = setup(PaymentOptionConfig, props())
    await replaceText(user, screen.getByLabelText(/^merchant_name/), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('merchant_name is required')).toBeInTheDocument()
  })

  it('saves the full data object of what was edited', async () => {
    const { user, onSave } = setup(PaymentOptionConfig, props())
    await replaceText(user, screen.getByLabelText(/^merchant_name/), 'New shop')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      data: { merchant_name: 'New shop', b_secret_key: 'mock_01_xxxxxx6789', marketplace_fee_percent: '5' }
    })
  })
})

describe('PaymentOptionGlobal (keys live in Settings)', () => {
  const props = (extra = {}) => ({
    paymethod: { id: 1, gateway: 'stripe', name: 'Stripe', data_template: [] },
    businessPaymethod: record(),
    ...extra
  })

  it('offers General (0), Channels (1) and Order type (2) to a level 0 user', async () => {
    state.configs = { stripe_publishable: { key: 'stripe_publishable', value: 'pk_live' } }
    const { user, onTabChange } = setup(PaymentOptionGlobal, props())
    expect(tabNames()).toEqual(['General', 'Channels', 'Order type'])
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
  })

  it('has no General for a level 2 user, who lands on Channels (or Order type with no sites)', () => {
    state.level = 2
    const { unmount } = renderWithProviders(
      <PaymentOptionGlobal {...props()} sites={SITES} devices={[]} orderTypes={ORDER_TYPES} />,
      { theme }
    )
    expect(tabNames()).toEqual(['Channels', 'Order type'])
    expect(screen.getByRole('tab', { name: 'Channels' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    renderWithProviders(
      <PaymentOptionGlobal {...props()} sites={[]} devices={[]} orderTypes={ORDER_TYPES} />,
      { theme }
    )
    expect(tabNames()).toEqual(['Order type'])
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
  })

  it('says the API keys are configured and links to the gateway in Settings', () => {
    state.configs = { stripe_publishable: { key: 'stripe_publishable', value: 'pk_live' } }
    setup(PaymentOptionGlobal, props())
    expect(screen.getByText('API keys configured')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit in Settings' }))
      .toHaveAttribute('href', '/settings?group=payments&category=stripe')
  })

  // review F3 #3: «Edit in Settings» leaves through the detail's guards, so unsaved changes ask first
  it('asks the detail before leaving for Settings', async () => {
    const guard = vi.fn(() => true)
    renderWithProviders(
      <SectionSplit open detailKey='1' detailTitle='Stripe' closeLabel='Close' backLabel='Back' closeGuard={guard} list={<span />}
        detail={<PaymentOptionGlobal {...props()} sites={SITES} devices={[]} orderTypes={ORDER_TYPES} />}
      />,
      { theme }
    )
    await userEvent.click(screen.getByRole('link', { name: 'Edit in Settings' }))
    expect(guard).toHaveBeenCalledTimes(1)
    expect(typeof guard.mock.calls[0][0]).toBe('function')
  })

  it('says the API keys are missing when there are none', () => {
    setup(PaymentOptionGlobal, props())
    expect(screen.getByText('API keys missing')).toBeInTheDocument()
  })

  it('has no mode and no fields', () => {
    setup(PaymentOptionGlobal, props())
    expect(screen.queryByRole('button', { name: 'Sandbox' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('saves the channels that changed', async () => {
    const { user, onSave } = setup(PaymentOptionGlobal, props({ initialTab: 1 }))
    await user.click(screen.getByRole('checkbox', { name: 'All' }))
    await user.click(screen.getByRole('checkbox', { name: 'Web' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ sites: [10] })
  })
})

describe('PaymentOptionMethods (Apple Pay / Google Pay with Stripe)', () => {
  const props = (extra = {}) => ({
    paymethod: { id: 1, gateway: 'apple_pay', name: 'Apple Pay', data_template: null },
    gatewayName: 'Apple Pay',
    businessPaymethod: record({
      data: { publishable: 'pk_live_1', secret: 'sk_live_1' },
      data_sandbox: { publishable: 'pk_test_1', secret: 'sk_test_1' }
    }),
    ...extra
  })
  const live = () => screen.getByRole('group', { name: 'Live credentials' })
  const sandbox = () => screen.getByRole('group', { name: 'Sandbox credentials' })

  it('offers General (0), Channels (1) and Order type (2)', async () => {
    const { user, onTabChange } = setup(PaymentOptionMethods, props())
    expect(tabNames()).toEqual(['General', 'Channels', 'Order type'])
    expect(screen.getByRole('tablist', { name: 'Apple Pay' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
  })

  it('draws four fields in a Live and a Sandbox group, with the secrets hidden', () => {
    setup(PaymentOptionMethods, props())
    expect(input(live(), 'Publishable key')).toHaveValue('pk_live_1')
    expect(input(live(), 'Publishable key')).toHaveAttribute('type', 'text')
    expect(input(live(), 'Secret key')).toHaveValue('sk_live_1')
    expect(input(live(), 'Secret key')).toHaveAttribute('type', 'password')
    expect(input(sandbox(), 'Publishable key')).toHaveValue('pk_test_1')
    expect(input(sandbox(), 'Secret key')).toHaveValue('sk_test_1')
    expect(input(sandbox(), 'Secret key')).toHaveAttribute('type', 'password')
    expect(screen.queryByText(/\(Sandbox\)/)).not.toBeInTheDocument()
  })

  it('has the Live / Sandbox mode control', () => {
    setup(PaymentOptionMethods, props())
    expect(screen.getByRole('button', { name: 'Sandbox' })).toBeInTheDocument()
  })

  it('saves the full sandbox object of what was edited', async () => {
    const { user, onSave } = setup(PaymentOptionMethods, props())
    await replaceText(user, input(sandbox(), 'Publishable key'), 'pk_test_2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data_sandbox: { publishable: 'pk_test_2', secret: 'sk_test_1' } })
  })
})
