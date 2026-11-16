/* eslint-disable import/first */
// redesign stores 5.10b: the ePayco, Credomatic and Square forms of My payment methods on ProviderPanel. They are thin wrappers:
// these tests check what each one configures (tabs and the index `?paymethod_tab=` keeps from `main`, the fields with their label, the secrets
// behind Show, the Live / Sandbox control where main had one) and that two saves in a row always send the FULL `data` object (G4-04).
// ePayco uses `number` fields and `fieldsDisplay='plain'` of the panel (no group titles, no mode control).
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

import { PaymentOptionEpayco } from '../../PaymentOptionEpayco'
import { PaymentOptionCredomatic } from '../../PaymentOptionCredomatic'
import { PaymentOptionSquare } from '../../PaymentOptionSquare'

const ORDER_TYPES = [
  { value: 1, text: 'Delivery' },
  { value: 2, text: 'Pickup' }
]
const SITES = [{ id: 10, name: 'Web' }, { id: 11, name: 'App' }]
const DEVICES = [{ id: 20, name: 'Kiosk' }]

const SPLIT_RECEIVERS = [{ id: '123456', total: '10', iva: '1', base_iva: '9', fee: '0.5' }]

// `fields`: what main's form drew, with the label the group does not repeat. `grouped`: Live / Sandbox groups and the mode control (ePayco has neither).
// `first` and `second`: two fields of the Live group to edit, with the text to type (a number field takes digits).
const FORMS = [
  {
    name: 'PaymentOptionEpayco',
    Form: PaymentOptionEpayco,
    gateway: 'epayco',
    grouped: false,
    tabs: ['General', 'Channels', 'Order type'],
    fields: [
      { mode: 'live', key: 'receiver_id', label: 'Receiver ID', number: true },
      { mode: 'live', key: 'receiver_fee_percentage', label: 'Receiver fee (%)', number: true },
      { mode: 'live', key: 'receiver_fee_fixed', label: 'Receiver fixed fee', number: true }
    ],
    extraData: { split_receivers: SPLIT_RECEIVERS },
    first: { key: 'receiver_id', text: '991' },
    second: { key: 'receiver_fee_percentage', text: '7' }
  },
  {
    name: 'PaymentOptionCredomatic',
    Form: PaymentOptionCredomatic,
    gateway: 'credomatic',
    grouped: true,
    tabs: ['General', 'Channels', 'Order type'],
    fields: [
      { mode: 'live', key: 'processor_id', label: 'Processor ID' },
      { mode: 'live', key: 'private_production_key', label: 'Private Production Key', secret: true },
      { mode: 'live', key: 'public_production_key', label: 'Public Production Key' },
      { mode: 'sandbox', key: 'private_sandbox_key', label: 'Private Sandbox Key', secret: true },
      { mode: 'sandbox', key: 'public_sandbox_key', label: 'Public Sandbox Key' }
    ],
    extraData: {},
    first: { key: 'processor_id', text: 'one' },
    second: { key: 'public_production_key', text: 'two' },
    firstSandbox: { key: 'public_sandbox_key', text: 'one' },
    secondSandbox: { key: 'private_sandbox_key', text: 'two' }
  },
  {
    name: 'PaymentOptionSquare',
    Form: PaymentOptionSquare,
    gateway: 'square',
    grouped: true,
    tabs: ['General', 'Channels', 'Order type', 'Devices'],
    fields: [
      { mode: 'live', key: 'application_id', label: 'Application Id' },
      { mode: 'live', key: 'location_id', label: 'Location Id' },
      { mode: 'live', key: 'client_secret', label: 'Client secret', secret: true },
      { mode: 'sandbox', key: 'application_id', label: 'Application Id' },
      { mode: 'sandbox', key: 'location_id', label: 'Location Id' },
      { mode: 'sandbox', key: 'client_secret', label: 'Client secret', secret: true }
    ],
    extraData: {},
    first: { key: 'application_id', text: 'one' },
    second: { key: 'location_id', text: 'two' },
    firstSandbox: { key: 'application_id', text: 'one' },
    secondSandbox: { key: 'location_id', text: 'two' }
  }
]

const seed = (field) => (field.number ? '12' : `${field.mode}-${field.key}`)
const dataOf = (fields, mode) => Object.fromEntries(fields.filter(field => field.mode === mode).map(field => [field.key, seed(field)]))

const record = ({ fields, extraData }, extra = {}) => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: { ...dataOf(fields, 'live'), kept: 'live-kept', ...extraData },
  data_sandbox: { ...dataOf(fields, 'sandbox'), kept: 'sandbox-kept' },
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const setup = (form, props = {}) => {
  const { Form, gateway } = form
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  renderWithProviders(
    <Form
      paymethod={{ id: 1, gateway, name: 'Gateway', data_template: null }}
      businessPaymethod={record(form)}
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
// where the Live fields are: in their group, or (ePayco, no group titles) anywhere in the panel
const liveScope = (form) => (form.grouped ? live() : document.body)
const labelOf = (form, mode, key) => form.fields.find(field => field.mode === mode && field.key === key).label

const replaceText = async (user, node, text) => {
  await user.clear(node)
  if (text) await user.type(node, text)
}

describe.each(FORMS)('$name on ProviderPanel', (form) => {
  const { fields } = form
  const secrets = fields.filter(field => field.secret)
  const lastTab = form.tabs.length - 1

  it(`offers ${form.tabs.join(', ')} with the indices of main`, async () => {
    const { user, onTabChange } = setup(form)
    expect(tabNames()).toEqual(form.tabs)
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(onTabChange).not.toHaveBeenCalled()
    // General is already the open tab: the others, then back to it
    for (const [index, name] of [...form.tabs.entries()].slice(1).concat([[0, 'General']])) {
      await user.click(screen.getByRole('tab', { name }))
      expect(onTabChange).toHaveBeenLastCalledWith(index)
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    }
  })

  it('honours initialTab, including the last tab', () => {
    setup(form, { initialTab: lastTab })
    expect(screen.getByRole('tab', { name: form.tabs[lastTab] })).toHaveAttribute('aria-selected', 'true')
  })

  it('drops Channels when the store has no channels and opens the first tab for an unknown ?paymethod_tab=', () => {
    setup(form, { sites: [], initialTab: 9 })
    expect(tabNames()).toEqual(form.tabs.filter(name => name !== 'Channels'))
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('draws every field of main with its label and the saved value', () => {
    setup(form)
    for (const mode of ['live', 'sandbox']) {
      const scope = mode === 'live' ? liveScope(form) : form.grouped ? sandbox() : null
      for (const field of fields.filter(item => item.mode === mode)) {
        const node = input(scope, field.label)
        expect(node).toHaveDisplayValue(seed(field))
        if (!field.number) expect(node).toHaveAttribute('type', field.secret ? 'password' : 'text')
      }
    }
    expect(screen.queryByText(/\(Sandbox\)/)).not.toBeInTheDocument()
  })

  it('has no required field: saving an emptied field is allowed, as in main', async () => {
    const { user, onSave } = setup(form)
    await replaceText(user, input(liveScope(form), labelOf(form, 'live', form.first.key)), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { ...record(form).data, [form.first.key]: '' } })
  })

  // G4-04: the second save used to send only the key touched after the first one
  it('G4-04: two saves in a row send the FULL data object each time', async () => {
    const { user, onSave } = setup(form)
    const { first, second } = form
    await replaceText(user, input(liveScope(form), labelOf(form, 'live', first.key)), first.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenLastCalledWith({ data: { ...record(form).data, [first.key]: first.text } })

    await replaceText(user, input(liveScope(form), labelOf(form, 'live', second.key)), second.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({
      data: { ...record(form).data, [first.key]: first.text, [second.key]: second.text }
    })
    expect(Object.keys(onSave.mock.calls[1][0])).toEqual(['data'])
  })

  it('shows the error of a failed save in the bar and keeps what was typed', async () => {
    const { user, onSave } = setup(form)
    onSave.mockResolvedValue({ ok: false, error: 'X' })
    const label = labelOf(form, 'live', form.first.key)
    await replaceText(user, input(liveScope(form), label), form.first.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('X')
    expect(input(liveScope(form), label)).toHaveDisplayValue(form.first.text)
  })

  it('saves the order types that changed', async () => {
    const { user, onSave } = setup(form, { initialTab: 2 })
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1] })
  })

  it('saves the channels that changed', async () => {
    const { user, onSave } = setup(form, { initialTab: 1 })
    await user.click(screen.getByRole('checkbox', { name: 'All' }))
    await user.click(screen.getByRole('checkbox', { name: 'Web' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ sites: [10] })
  })

  if (secrets.length > 0) {
    it('hides every secret behind a Show button and leaves the other fields in the clear', async () => {
      const { user } = setup(form)
      const liveSecrets = secrets.filter(field => field.mode === 'live')
      const sandboxSecrets = secrets.filter(field => field.mode === 'sandbox')
      if (liveSecrets.length > 0) expect(within(live()).getAllByRole('button', { name: /^Show/ })).toHaveLength(liveSecrets.length)
      if (sandboxSecrets.length > 0) expect(within(sandbox()).getAllByRole('button', { name: /^Show/ })).toHaveLength(sandboxSecrets.length)
      const [secret] = secrets.filter(field => field.mode === 'live').concat(sandboxSecrets)
      const scope = secret.mode === 'live' ? live() : sandbox()
      const secretInput = input(scope, secret.label)
      expect(secretInput).toHaveAttribute('type', 'password')
      await user.click(within(scope).getAllByRole('button', { name: /^Show/ })[0])
      expect(secretInput).toHaveAttribute('type', 'text')
      for (const field of fields.filter(item => !item.secret)) {
        const own = field.mode === 'live' ? live() : sandbox()
        expect(input(own, field.label)).toHaveAttribute('type', 'text')
      }
    })
  } else {
    it('has no secret: no Show button at all', () => {
      setup(form)
      expect(screen.queryByRole('button', { name: /^Show/ })).not.toBeInTheDocument()
    })
  }
})

describe('PaymentOptionEpayco · what main did not have', () => {
  const [epayco] = FORMS

  it('has no Live / Sandbox control and no group titles', () => {
    setup(epayco)
    expect(screen.queryByRole('button', { name: 'Live' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sandbox' })).not.toBeInTheDocument()
    expect(screen.queryByText('Customers pay with real money.')).not.toBeInTheDocument()
    expect(screen.queryByText('Live credentials')).not.toBeInTheDocument()
    expect(screen.queryByText('Sandbox credentials')).not.toBeInTheDocument()
  })

  it('tells that it is only available for COP and USD', () => {
    setup(epayco)
    expect(screen.getByText('Only available for COP and USD currency')).toBeInTheDocument()
  })

  it('keeps a split_receivers already saved in data: two saves in a row send it back each time', async () => {
    const { user, onSave } = setup(epayco)
    await replaceText(user, input(document.body, 'Receiver ID'), '991')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await replaceText(user, input(document.body, 'Receiver fixed fee'), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    for (const [changes] of onSave.mock.calls) {
      expect(changes.data.split_receivers).toEqual(SPLIT_RECEIVERS)
    }
    expect(onSave).toHaveBeenLastCalledWith({
      data: { ...record(epayco).data, receiver_id: '991', receiver_fee_fixed: '5' }
    })
  })

  it('does not draw the split receivers table or its modal (dead code in main, G4-22)', () => {
    setup(epayco)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Add new receiver')).not.toBeInTheDocument()
  })
})

describe.each(FORMS.filter(form => form.grouped))('$name · Live / Sandbox', (form) => {
  const { fields } = form

  it('has the Live / Sandbox mode control and both credential groups', async () => {
    const { user } = setup(form)
    expect(screen.getByText('Customers pay with real money.')).toBeInTheDocument()
    expect(live()).toBeInTheDocument()
    expect(sandbox()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(screen.getByText('Test mode: no real payments are taken.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Live' })).toBeInTheDocument()
  })

  it('keeps each field in its own group: each group draws exactly its own fields', () => {
    setup(form)
    for (const mode of ['live', 'sandbox']) {
      const scope = mode === 'live' ? live() : sandbox()
      expect(scope.querySelectorAll('input')).toHaveLength(fields.filter(field => field.mode === mode).length)
    }
  })

  // G4-04 in the Sandbox group
  it('G4-04 in the Sandbox group: the full data_sandbox object, both edits and what the record had', async () => {
    const { user, onSave } = setup(form)
    const { firstSandbox, secondSandbox } = form
    await replaceText(user, input(sandbox(), labelOf(form, 'sandbox', firstSandbox.key)), firstSandbox.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await replaceText(user, input(sandbox(), labelOf(form, 'sandbox', secondSandbox.key)), secondSandbox.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith({
      data_sandbox: {
        ...record(form).data_sandbox,
        [firstSandbox.key]: firstSandbox.text,
        [secondSandbox.key]: secondSandbox.text
      }
    })
  })

  it('a Sandbox edit leaves the Live data out of the request, and the other way round', async () => {
    const { user, onSave } = setup(form)
    await replaceText(user, input(sandbox(), labelOf(form, 'sandbox', form.firstSandbox.key)), form.firstSandbox.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.keys(onSave.mock.calls[0][0])).toEqual(['data_sandbox'])
    await replaceText(user, input(live(), labelOf(form, 'live', form.first.key)), form.first.text)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(Object.keys(onSave.mock.calls[1][0])).toEqual(['data'])
  })
})

describe('PaymentOptionCredomatic · labels of main', () => {
  it('the Sandbox keys have the label of main without the stray «)» of its placeholder (G4-29)', () => {
    setup(FORMS[1])
    expect(input(sandbox(), 'Public Sandbox Key')).toBeInTheDocument()
    expect(screen.queryByLabelText(/\)$/)).not.toBeInTheDocument()
  })
})

describe('PaymentOptionSquare · General and Devices', () => {
  const [, , square] = FORMS

  // D-16 (owner, stage 2): «Connect with Square» is gone. It never had a handler (no Square OAuth flow, in main either), so it was a
  // button that did nothing; an OAuth flow is asked of backend only if the business wants to sell Square with it.
  it('has no «Connect with Square» in any tab; the keys are still there', async () => {
    const { user } = setup(square)
    expect(screen.queryByRole('button', { name: 'Connect with Square' })).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Application Id').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: 'Devices' }))
    expect(screen.queryByRole('button', { name: 'Connect with Square' })).not.toBeInTheDocument()
  })

  it('Devices (3) lists the store devices and saves the ones picked', async () => {
    const { user, onSave } = setup(square, { initialTab: 3 })
    await user.click(screen.getByRole('checkbox', { name: 'Kiosk' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ devices: [20] })
  })

  it('Devices (3) says so when the store has no devices', async () => {
    setup(square, { devices: [], initialTab: 3 })
    expect(screen.getByText('There are no assigned devices')).toBeInTheDocument()
  })
})
