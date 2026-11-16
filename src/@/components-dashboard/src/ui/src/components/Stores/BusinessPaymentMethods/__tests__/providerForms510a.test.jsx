/* eslint-disable import/first */
// redesign stores 5.10a: the PayPal, Stripe direct and Mercado Pago forms of My payment methods on ProviderPanel. They are thin
// wrappers: these tests check what each one configures (tabs and the index `?paymethod_tab=` keeps from `main`, the Live and Sandbox groups,
// the secrets behind Show, the mode control) and that two saves in a row always send the FULL `data` object (G4-04).
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'acme' }],
  useToast: () => [{}, { showToast: () => {} }]
}))

import { PaymentOptionPaypal } from '../../PaymentOptionPaypal'
import { PaymentOptionStripeDirect } from '../../PaymentOptionStripeDirect'
import { PaymentOptionMercadoPago } from '../../PaymentOptionMercadoPago'

const ORDER_TYPES = [
  { value: 1, text: 'Delivery' },
  { value: 2, text: 'Pickup' }
]
const SITES = [{ id: 10, name: 'Web' }, { id: 11, name: 'App' }]
const DEVICES = [{ id: 20, name: 'Kiosk' }]

// `fields`: what main's form drew, with the label the group does not repeat (the group already says Sandbox)
const FORMS = [
  {
    name: 'PaymentOptionPaypal',
    Form: PaymentOptionPaypal,
    gateway: 'paypal',
    fields: [
      { key: 'client_id', label: 'Client ID' },
      { key: 'secret', label: 'Secret ID', secret: true }
    ]
  },
  {
    name: 'PaymentOptionStripeDirect',
    Form: PaymentOptionStripeDirect,
    gateway: 'stripe_checkout',
    fields: [
      { key: 'publishable', label: 'Publishable key' },
      { key: 'secret', label: 'Secret key', secret: true }
    ]
  },
  {
    name: 'PaymentOptionMercadoPago',
    Form: PaymentOptionMercadoPago,
    gateway: 'checkout_pro_mercadopago',
    fields: [
      { key: 'public_key', label: 'Public key' },
      { key: 'access_token', label: 'Access token', secret: true },
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client secret', secret: true }
    ]
  }
]

const dataOf = (fields, mode) => Object.fromEntries(fields.map(field => [field.key, `${mode}-${field.key}`]))

const record = (fields, extra = {}) => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: { ...dataOf(fields, 'live'), kept: 'live-kept' },
  data_sandbox: { ...dataOf(fields, 'sandbox'), kept: 'sandbox-kept' },
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const setup = ({ Form, gateway, fields }, props = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  renderWithProviders(
    <Form
      paymethod={{ id: 1, gateway, name: 'Gateway', data_template: null }}
      businessPaymethod={record(fields)}
      gatewayName='Gateway'
      storeName='Burger Hub'
      sites={SITES}
      devices={DEVICES}
      orderTypes={ORDER_TYPES}
      onSave={onSave}
      onTabChange={onTabChange}
      {...props}
    />,
    { theme }
  )
  return { user, onSave, onTabChange }
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent)
// the Show button of a secret is also named through the field's label, so only the input counts
const input = (scope, name) => within(scope).getAllByLabelText(name).find(node => node.tagName === 'INPUT')
const live = () => screen.getByRole('group', { name: 'Live credentials' })
const sandbox = () => screen.getByRole('group', { name: 'Sandbox credentials' })

const replaceText = async (user, node, text) => {
  await user.clear(node)
  if (text) await user.type(node, text)
}

describe.each(FORMS)('$name on ProviderPanel', (form) => {
  const { fields } = form
  const [first, second] = fields

  it('offers General (0), Channels (1) and Order type (2) with the indices of main', async () => {
    const { user, onTabChange } = setup(form)
    expect(tabNames()).toEqual(['General', 'Channels', 'Order type'])
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(onTabChange).not.toHaveBeenCalled()
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('tab', { name: 'General' }))
    expect(onTabChange).toHaveBeenLastCalledWith(0)
  })

  it('honours initialTab', () => {
    setup(form, { initialTab: 2 })
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
  })

  it('draws the same fields in a Live and a Sandbox group, with the label of main and no mode in it', () => {
    setup(form)
    for (const [group, mode] of [[live, 'live'], [sandbox, 'sandbox']]) {
      for (const field of fields) {
        const node = input(group(), field.label)
        expect(node).toHaveValue(`${mode}-${field.key}`)
        expect(node).toHaveAttribute('type', field.secret ? 'password' : 'text')
      }
    }
    expect(screen.queryByText(/\(Sandbox\)/)).not.toBeInTheDocument()
  })

  it('hides every secret behind a Show button and leaves the other fields in the clear', async () => {
    const { user } = setup(form)
    const secrets = fields.filter(field => field.secret)
    expect(within(live()).getAllByRole('button', { name: /^Show/ })).toHaveLength(secrets.length)
    expect(within(sandbox()).getAllByRole('button', { name: /^Show/ })).toHaveLength(secrets.length)
    const secretInput = input(live(), secrets[0].label)
    expect(secretInput).toHaveAttribute('type', 'password')
    await user.click(within(live()).getAllByRole('button', { name: /^Show/ })[0])
    expect(secretInput).toHaveAttribute('type', 'text')
    for (const field of fields.filter(item => !item.secret)) {
      expect(input(live(), field.label)).toHaveAttribute('type', 'text')
    }
  })

  it('has the Live / Sandbox mode control', async () => {
    const { user } = setup(form)
    expect(screen.getByText('Customers pay with real money.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(screen.getByText('Test mode: no real payments are taken.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Live' })).toBeInTheDocument()
  })

  it('has no required field: saving an emptied field is allowed, as in main', async () => {
    const { user, onSave } = setup(form)
    await replaceText(user, input(live(), first.label), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { ...dataOf(fields, 'live'), kept: 'live-kept', [first.key]: '' } })
  })

  // G4-04: the second save used to send only the key touched after the first one
  it('G4-04: two saves in a row send the FULL data object each time', async () => {
    const { user, onSave } = setup(form)
    await replaceText(user, input(live(), first.label), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenLastCalledWith({ data: { ...dataOf(fields, 'live'), kept: 'live-kept', [first.key]: 'one' } })

    await replaceText(user, input(live(), second.label), 'two')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({
      data: { ...dataOf(fields, 'live'), kept: 'live-kept', [first.key]: 'one', [second.key]: 'two' }
    })
    expect(Object.keys(onSave.mock.calls[1][0])).toEqual(['data'])
  })

  it('G4-04 in the Sandbox group: the full data_sandbox object, both edits and what the record had', async () => {
    const { user, onSave } = setup(form)
    await replaceText(user, input(sandbox(), first.label), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await replaceText(user, input(sandbox(), second.label), 'two')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({
      data_sandbox: { ...dataOf(fields, 'sandbox'), kept: 'sandbox-kept', [first.key]: 'one', [second.key]: 'two' }
    })
  })

  it('shows the error of a failed save in the bar and keeps what was typed', async () => {
    const { user, onSave } = setup(form)
    onSave.mockResolvedValue({ ok: false, error: 'X' })
    await replaceText(user, input(live(), first.label), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('X')
    expect(input(live(), first.label)).toHaveValue('one')
  })

  it('saves the order types that changed', async () => {
    const { user, onSave } = setup(form, { initialTab: 2 })
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1] })
  })
})
