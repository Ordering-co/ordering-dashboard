/* eslint-disable import/first */
// redesign stores 5.9: the shared detail of a payment gateway (tabs, credentials with a Live/Sandbox mode, channels,
// order types, devices, one save bar, the leave guard and the sandbox confirmation). Config-driven: these tests pass `tabs` and `fields`
// as a provider form would.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../../../Shared/Product/LeaveGuard'
import { ProviderPanel } from '../index'

const PAYMETHOD = { id: 1, gateway: 'paypal', name: 'PayPal', data_template: [] }

const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 },
  { id: 'devices', index: 3 }
]

const FIELDS = [
  { key: 'client_id', label: 'Client ID', mode: 'live', required: true },
  { key: 'client_secret', label: 'Client secret', mode: 'live', secret: true },
  { key: 'client_id', label: 'Client ID', mode: 'sandbox', required: true },
  { key: 'client_secret', label: 'Client secret', mode: 'sandbox', secret: true }
]

const ORDER_TYPES = [
  { value: 1, text: 'Delivery' },
  { value: 2, text: 'Pickup' },
  { value: 3, text: 'Eat in' }
]

const record = (extra = {}) => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: { client_id: 'live-id', client_secret: 'live-secret' },
  data_sandbox: { client_id: 'test-id', client_secret: 'test-secret' },
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const baseProps = () => ({
  paymethod: PAYMETHOD,
  businessPaymethod: record(),
  gatewayName: 'PayPal',
  storeName: 'Burger Hub',
  tabs: TABS,
  sites: [],
  devices: [],
  orderTypes: ORDER_TYPES,
  showMode: true,
  fields: FIELDS,
  fieldsDisplay: 'both'
})

const setup = (props = {}, options = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  const utils = renderWithProviders(<ProviderPanel {...baseProps()} onSave={onSave} onTabChange={onTabChange} {...props} />, { theme, ...options })
  return { user, onSave, onTabChange, ...utils }
}

// the Show button of a secret is also named through the field's label, so only the input counts
const input = (scope, name) => within(scope).getAllByLabelText(name).find(node => node.tagName === 'INPUT')
const live = () => screen.getByRole('group', { name: 'Live credentials' })
const sandbox = () => screen.getByRole('group', { name: 'Sandbox credentials' })

const replaceText = async (user, node, text) => {
  await user.clear(node)
  if (text) await user.type(node, text)
}

describe('tabs', () => {
  it('offers the listed tabs, without Channels when the store has no sites', () => {
    setup()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Order type', 'Devices'])
    expect(screen.getByRole('tablist', { name: 'PayPal' })).toBeInTheDocument()
  })

  it('offers Channels when there are sites', () => {
    setup({ sites: [{ id: 1, name: 'Web' }] })
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Channels', 'Order type', 'Devices'])
  })

  // redesign bugs F row 33: at 390 px the fourth tab (Devices, Square) hid past the scroll edge; the tabs wrap instead
  it('F33: the tabs wrap (four tabs, none hidden past a scroll edge at 390 px)', () => {
    const { container } = setup({ sites: [{ id: 1, name: 'Web' }] })
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(container.querySelector('.odc-tabs')).toHaveAttribute('data-wrap', 'true')
    expect(container.querySelector('.odc-tabs-list')).not.toHaveClass('odc-fade-x')
  })

  it('follows the order and the listing of `tabs`', () => {
    setup({ tabs: [{ id: 'order_types', index: 5 }, { id: 'general', index: 6 }] })
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Order type', 'General'])
  })

  it('opens the first tab when there is no initialTab', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('honours initialTab when it is the index of an available tab', () => {
    setup({ initialTab: 3 })
    expect(screen.getByRole('tab', { name: 'Devices' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('There are no assigned devices')).toBeInTheDocument()
  })

  it('G4-20: an initialTab that is not available falls back to the first tab', () => {
    // Channels is index 1 but the store has no sites
    setup({ initialTab: 1 })
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('an initialTab that is not an index at all falls back to the first tab', () => {
    setup({ initialTab: 42 })
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onTabChange when the user picks a tab, not on mount', async () => {
    const { user, onTabChange } = setup()
    expect(onTabChange).not.toHaveBeenCalled()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith(2)
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument()
  })

  it('does not offer General when it has nothing at all', () => {
    setup({ showMode: false, fields: [], generalBefore: undefined })
    expect(screen.queryByRole('tab', { name: 'General' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
  })

  it('offers General with only generalBefore', () => {
    setup({ showMode: false, fields: [], generalBefore: <p>Connect your account</p> })
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByText('Connect your account')).toBeInTheDocument()
  })

  // redesign stores 5.10a: `generalAfter` closes the General tab, after the fields
  it('generalAfter: draws the node after the last field of General, and not in the other tabs', async () => {
    const { user } = setup({ generalAfter: <p>Enable these after Twilio</p> })
    const note = screen.getByText('Enable these after Twilio')
    const lastField = input(sandbox(), 'Client secret')
    expect(lastField.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sandbox().compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.queryByText('Enable these after Twilio')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Devices' }))
    expect(screen.queryByText('Enable these after Twilio')).not.toBeInTheDocument()
  })

  it('generalAfter: sits after the mode control and after generalBefore too', () => {
    setup({ generalBefore: <p>Before</p>, generalAfter: <p>After</p> })
    const before = screen.getByText('Before')
    const mode = screen.getByRole('button', { name: 'Sandbox' })
    const after = screen.getByText('After')
    expect(before.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mode.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers General with only generalAfter (no fields, no mode)', () => {
    setup({ showMode: false, fields: [], generalAfter: <p>Only after</p> })
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByText('Only after')).toBeInTheDocument()
  })

  it('without generalAfter the panel is the same: no General without anything to draw, nothing extra with fields', () => {
    const { unmount } = setup({ showMode: false, fields: [] })
    expect(screen.queryByRole('tab', { name: 'General' })).not.toBeInTheDocument()
    unmount()
    const { container } = setup()
    expect(container.querySelector('.odc-pp-body').lastElementChild).toBe(sandbox())
  })
})

describe('general: mode and credentials', () => {
  it('draws generalBefore above the mode', () => {
    setup({ generalBefore: <p>Global keys are set</p> })
    expect(screen.getByText('Global keys are set')).toBeInTheDocument()
  })

  it('shows the mode with its live hint, and the sandbox hint when it is sandbox', async () => {
    const { user } = setup()
    expect(screen.getByText('Customers pay with real money.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(screen.getByText('Test mode: no real payments are taken.')).toBeInTheDocument()
    expect(screen.queryByText('Customers pay with real money.')).not.toBeInTheDocument()
  })

  it('has no mode control without showMode', () => {
    setup({ showMode: false })
    expect(screen.queryByRole('button', { name: 'Sandbox' })).not.toBeInTheDocument()
  })

  it('both: draws a Live and a Sandbox group with their fields', () => {
    setup()
    expect(within(live()).getByRole('heading', { level: 4, name: 'Live credentials' })).toBeInTheDocument()
    expect(within(sandbox()).getByRole('heading', { level: 4, name: 'Sandbox credentials' })).toBeInTheDocument()
    expect(input(live(), /^Client ID/)).toHaveValue('live-id')
    expect(input(sandbox(), /^Client ID/)).toHaveValue('test-id')
  })

  // tanda P: a non-secret key (Client ID, Publishable key, User ID) took the page's right-to-left direction in Arabic and
  // was read from its end; the text field takes the direction of its value, as the secret fields are LTR
  it('the text fields take the direction of their value (a key reads from its start in an RTL page)', () => {
    setup()
    expect(input(live(), /^Client ID/)).toHaveAttribute('dir', 'auto')
  })

  it('active: draws only the fields of the mode in the draft, and follows the mode', async () => {
    const { user } = setup({ fieldsDisplay: 'active' })
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Client ID/)).toHaveLength(1)
    expect(screen.getByLabelText(/^Client ID/)).toHaveValue('live-id')
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(screen.getAllByLabelText(/^Client ID/)).toHaveLength(1)
    expect(screen.getByLabelText(/^Client ID/)).toHaveValue('test-id')
  })

  it('a secret is hidden and has Show; a plain field is text; any other type is a plain text field', async () => {
    const { user } = setup({
      fields: [
        ...FIELDS.slice(0, 2),
        { key: 'email', label: 'Email', mode: 'live', type: 'email' },
        { key: 'tipo', label: 'Kind', mode: 'live', type: 'select' }
      ]
    })
    const secret = input(live(), 'Client secret')
    expect(secret).toHaveAttribute('type', 'password')
    expect(input(live(), /^Client ID/)).toHaveAttribute('type', 'text')
    expect(input(live(), 'Email')).toHaveAttribute('type', 'email')
    expect(input(live(), 'Kind')).toHaveAttribute('type', 'text')
    await user.click(within(live()).getByRole('button', { name: /^Show/ }))
    expect(secret).toHaveAttribute('type', 'text')
  })

  it('a secret shows how it ends once it is long enough', () => {
    setup({ businessPaymethod: record({ data: { client_id: 'a', client_secret: 'mock_01_xxxxxxxxxxxxcdef' } }) })
    expect(within(live()).getByText(/Ends in/)).toHaveTextContent('Ends in …cdef')
  })

  it('marks the required fields of the active mode only', async () => {
    const { user } = setup()
    expect(within(live()).getByText('Required')).toBeInTheDocument()
    expect(within(sandbox()).queryByText('Required')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    expect(within(sandbox()).getByText('Required')).toBeInTheDocument()
    expect(within(live()).queryByText('Required')).not.toBeInTheDocument()
  })
})

describe('saving credentials', () => {
  it('sends only what changed: the full data object', async () => {
    const { user, onSave } = setup()
    expect(screen.queryByRole('group', { name: 'PayPal' })).not.toBeInTheDocument()
    await replaceText(user, input(live(), 'Client secret'), 'new-secret')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: 'new-secret' } })
  })

  it('counts the changes in the bar', async () => {
    const { user } = setup()
    await replaceText(user, input(live(), 'Client secret'), 'a')
    await replaceText(user, input(sandbox(), 'Client secret'), 'b')
    expect(screen.getByRole('group', { name: 'PayPal' })).toHaveTextContent('2 unsaved changes')
  })

  it('G4-23: an emptied field is sent empty', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(live(), 'Client secret'), '')
    expect(input(live(), 'Client secret')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: '' } })
  })

  it('G4-23: an edit of the sandbox credentials is sent while the mode is live', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(sandbox(), 'Client secret'), 'test-new')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data_sandbox: { client_id: 'test-id', client_secret: 'test-new' } })
  })

  it('a required empty field blocks onSave, shows the error and takes the focus', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(live(), /^Client ID/), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(within(live()).getByText('Client ID is required')).toBeInTheDocument()
    expect(input(live(), /^Client ID/)).toHaveFocus()
  })

  it('shows no required error before a Save attempt, and clears it when the field is filled', async () => {
    const { user } = setup()
    await replaceText(user, input(live(), /^Client ID/), '')
    expect(screen.queryByText('Client ID is required')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Client ID is required')).toBeInTheDocument()
    await user.type(input(live(), /^Client ID/), 'x')
    expect(screen.queryByText('Client ID is required')).not.toBeInTheDocument()
  })

  it('a required field of the other mode does not block', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(sandbox(), /^Client ID/), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data_sandbox: { client_id: '', client_secret: 'test-secret' } })
  })

  it('after a good save the baseline is the draft: the bar says Saved and the next save sends the new full object', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(live(), 'Client secret'), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await replaceText(user, input(live(), /^Client ID/), 'other')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenLastCalledWith({ data: { client_id: 'other', client_secret: 'one' } })
  })

  it('an onSave that answers nothing counts as saved', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = setup({ onSave })
    await replaceText(user, input(live(), 'Client secret'), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('a failed save shows the API message, keeps the draft and can be retried; Discard resets', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: ['Bad key'] })
    const { user } = setup({ onSave })
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad key')
    expect(input(live(), 'Client secret')).toHaveValue('typed')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()

    onSave.mockResolvedValueOnce({ ok: true })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('a failed save without a message says the payment method was not saved', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false })
    const { user } = setup({ onSave })
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The payment method could not be saved. Please try again.')
  })

  it('a save that throws is a failed save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network'))
    const { user } = setup({ onSave })
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(input(live(), 'Client secret')).toHaveValue('typed')
  })

  it('Discard puts the draft back to the saved values', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(input(live(), 'Client secret')).toHaveValue('live-secret')
    expect(screen.getByText('Customers pay with real money.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

// redesign stores 5.10b: opt-in `number` on a field (NumberField, a range notice that never blocks) and `fieldsDisplay='plain'`
describe('number fields and plain display (5.10b)', () => {
  const NUMBER_FIELDS = [
    { key: 'client_id', label: 'Client ID', mode: 'live' },
    { key: 'timeout', label: 'Timeout', mode: 'live', number: { min: 0, max: 100 } }
  ]
  const numberRecord = (timeout) => record({ data: { client_id: 'live-id', timeout } })
  const withNumber = (timeout, fields = NUMBER_FIELDS) => ({ fields, showMode: false, businessPaymethod: numberRecord(timeout) })

  it('a field with `number` is a NumberField tied to its label; typing 3.5 saves the string "3.5" in the full data object', async () => {
    const { user, onSave } = setup(withNumber('10'))
    const field = screen.getByLabelText('Timeout')
    expect(field).toHaveValue('10')
    expect(field).toHaveAttribute('aria-roledescription', 'Number field')
    await replaceText(user, field, '3.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', timeout: '3.5' } })
  })

  it('emptying a number field sends an empty string, not null', async () => {
    const { user, onSave } = setup(withNumber('10'))
    await replaceText(user, screen.getByLabelText('Timeout'), '')
    expect(screen.getByLabelText('Timeout')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', timeout: '' } })
  })

  it('a saved value outside the range is shown intact with a notice, and is neither clipped nor blocking', async () => {
    const { user, onSave } = setup(withNumber('150'))
    expect(screen.getByLabelText('Timeout')).toHaveValue('150')
    expect(screen.getByText('Usually between 0 and 100. Check this value.')).toBeInTheDocument()
    await replaceText(user, screen.getByLabelText(/^Client ID/), 'other-id')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'other-id', timeout: '150' } })
  })

  it('the range notice follows the value and only names the bounds the field has', async () => {
    const { user } = setup(withNumber('50'))
    expect(screen.queryByText(/Usually/)).not.toBeInTheDocument()
    await replaceText(user, screen.getByLabelText('Timeout'), '101')
    expect(screen.getByText('Usually between 0 and 100. Check this value.')).toBeInTheDocument()
    await replaceText(user, screen.getByLabelText('Timeout'), '5')
    expect(screen.queryByText(/Usually/)).not.toBeInTheDocument()
  })

  it('with only min or only max the notice says so', () => {
    const { unmount } = setup(withNumber('-3', [{ key: 'timeout', label: 'Timeout', mode: 'live', number: { min: 0 } }]))
    expect(screen.getByText('Usually 0 or more. Check this value.')).toBeInTheDocument()
    unmount()
    setup(withNumber('9', [{ key: 'timeout', label: 'Timeout', mode: 'live', number: { max: 5 } }]))
    expect(screen.getByText('Usually 5 or less. Check this value.')).toBeInTheDocument()
  })

  it('a saved value that is not a number stays visible in a text field, with a hint', () => {
    setup(withNumber('abc'))
    const field = screen.getByLabelText('Timeout')
    expect(field).toHaveValue('abc')
    expect(field).toHaveAttribute('type', 'text')
    expect(field).not.toHaveAttribute('aria-roledescription', 'Number field')
    expect(screen.getByText('This is not a number. Check it before saving.')).toBeInTheDocument()
  })

  it('G4-23: `type: number` without `number` is still a plain text field', () => {
    setup(withNumber('7', [{ key: 'timeout', label: 'Timeout', mode: 'live', type: 'number' }]))
    const field = screen.getByLabelText('Timeout')
    expect(field).toHaveValue('7')
    expect(field).toHaveAttribute('type', 'text')
    expect(field).not.toHaveAttribute('aria-roledescription', 'Number field')
  })

  it('plain: draws the fields of both modes in one group, with no group titles', () => {
    setup({ fieldsDisplay: 'plain' })
    expect(screen.queryByText('Live credentials')).not.toBeInTheDocument()
    expect(screen.queryByText('Sandbox credentials')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Live credentials' })).not.toBeInTheDocument()
    const ids = screen.getAllByLabelText(/^Client ID/).filter(node => node.tagName === 'INPUT')
    expect(ids.map(node => node.value)).toEqual(['live-id', 'test-id'])
    expect(ids[0].closest('.odc-pp-group')).toBe(ids[1].closest('.odc-pp-group'))
  })
})

describe('sandbox confirmation', () => {
  it('an enabled gateway going from Live to Sandbox asks first; Cancel does not save', async () => {
    const { user, onSave } = setup()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Switch PayPal to sandbox?')).toBeInTheDocument()
    expect(within(dialog).getByText('Burger Hub will stop taking real payments with PayPal. Test credentials are used until you switch back to live.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onSave).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // the draft is still sandbox and still unsaved
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('Use sandbox saves', async () => {
    const { user, onSave } = setup()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Use sandbox' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({ sandbox: true })
  })

  it('a gateway that is off goes to Sandbox without the dialog', async () => {
    const { user, onSave } = setup({ businessPaymethod: record({ enabled: false }) })
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith({ sandbox: true })
  })

  it('a gateway that is already sandbox saves a credential edit without the dialog', async () => {
    const { user, onSave } = setup({ businessPaymethod: record({ sandbox: true }) })
    await replaceText(user, input(sandbox(), 'Client secret'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  // redesign D-84 (owner, 2026-10-19): Sandbox -> Live asks too, with the same tone and the same Cancel
  it('an enabled gateway going from Sandbox to Live asks first; Cancel does not save', async () => {
    const { user, onSave } = setup({ businessPaymethod: record({ sandbox: true }) })
    await user.click(screen.getByRole('button', { name: 'Live' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Switch PayPal to live?')).toBeInTheDocument()
    expect(within(dialog).getByText("Burger Hub will start taking real payments with PayPal. Real charges can't be undone.")).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onSave).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // the draft is still live and still unsaved
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('Use live saves', async () => {
    const { user, onSave } = setup({ businessPaymethod: record({ sandbox: true }) })
    await user.click(screen.getByRole('button', { name: 'Live' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Use live' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({ sandbox: false })
  })

  it('a gateway that is off goes to Live without the dialog', async () => {
    const { user, onSave } = setup({ businessPaymethod: record({ enabled: false, sandbox: true }) })
    await user.click(screen.getByRole('button', { name: 'Live' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith({ sandbox: false })
  })

  it('the Live dialog does not show the Sandbox texts, and the Sandbox dialog does not show the Live ones', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Use sandbox' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Use live' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Switch PayPal to live?')).not.toBeInTheDocument()
  })

  it('missing required fields block before the dialog', async () => {
    const { user, onSave } = setup()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await replaceText(user, input(sandbox(), /^Client ID/), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Client ID is required')).toBeInTheDocument()
  })
})

describe('channels', () => {
  const sites = [{ id: 1, name: 'Web' }, { id: 2, name: 'App' }]

  it('All is on with no sites; unticking it lists the sites; picking one saves [id]', async () => {
    const { user, onSave } = setup({ sites })
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    const all = screen.getByRole('checkbox', { name: 'All' })
    expect(all).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('checkbox', { name: 'Web' })).not.toBeInTheDocument()
    await user.click(all)
    expect(all).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Web' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('checkbox', { name: 'App' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ sites: [2] })
  })

  it('unticking All alone is not a change', async () => {
    const { user } = setup({ sites })
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    await user.click(screen.getByRole('checkbox', { name: 'All' }))
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('G4-21: sites that arrive as objects are shown ticked', async () => {
    const { user } = setup({ sites, businessPaymethod: record({ sites: [{ id: 1, name: 'Web' }] }) })
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(screen.getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Web' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'App' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('ticking All again sends an empty list', async () => {
    const { user, onSave } = setup({ sites, businessPaymethod: record({ sites: [1] }) })
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    await user.click(screen.getByRole('checkbox', { name: 'All' }))
    expect(screen.getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('checkbox', { name: 'Web' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ sites: [] })
  })
})

describe('order types and devices', () => {
  it('draws one checkbox per order type, ticked from the draft, and saves the new set', async () => {
    const { user, onSave } = setup()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Pickup' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Eat in' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('checkbox', { name: 'Eat in' }))
    expect(screen.getByRole('group', { name: 'PayPal' })).toHaveTextContent('1 unsaved change')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1, 3] })
  })

  it('uses the default order types when the record has none', async () => {
    setup({ initialTab: 2, businessPaymethod: record({ allowed_order_types: undefined }), orderTypes: [...ORDER_TYPES], defaultOrderTypes: [3] })
    expect(screen.getByRole('checkbox', { name: 'Eat in' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'false')
  })

  it('without defaultOrderTypes, a record with none gets all five', () => {
    setup({
      initialTab: 2,
      businessPaymethod: record({ allowed_order_types: undefined }),
      orderTypes: [1, 2, 3, 4, 5].map(value => ({ value, text: `Type ${value}` }))
    })
    expect(screen.getAllByRole('checkbox').every(box => box.getAttribute('aria-checked') === 'true')).toBe(true)
  })

  it('says so when there are no devices', () => {
    setup({ initialTab: 3 })
    expect(screen.getByText('There are no assigned devices')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('draws one checkbox per device and saves the ticked ids', async () => {
    const { user, onSave } = setup({ initialTab: 3, devices: [{ id: 9, name: 'Front till' }, { id: 10, name: 'Kitchen' }] })
    await user.click(screen.getByRole('checkbox', { name: 'Kitchen' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ devices: [10] })
  })
})

describe('leave guard', () => {
  const Host = ({ proceed, panelProps }) => {
    const { context, requestLeave, dialog } = useLeaveGuardHost()
    return (
      <LeaveGuardContext.Provider value={context}>
        <ProviderPanel {...panelProps} />
        <button type='button' onClick={() => requestLeave(proceed)}>Leave</button>
        <LeaveDialog
          {...dialog}
          title='Unsaved changes'
          keepLabel='Keep editing'
          saveLabel='Save and leave'
          discardLabel='Discard and leave'
          closeLabel='Close'
          description='You have unsaved changes'
        />
      </LeaveGuardContext.Provider>
    )
  }

  const mount = (extra = {}) => {
    const proceed = vi.fn()
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderWithProviders(<Host proceed={proceed} panelProps={{ ...baseProps(), onSave, ...extra }} />, { theme })
    return { proceed, onSave, user }
  }

  it('lets go at once when nothing changed', async () => {
    const { proceed, user } = mount()
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('asks when there are unsaved changes; Save and leave saves, then lets go', async () => {
    const { proceed, onSave, user } = mount()
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(proceed).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save and leave' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: 'typed' } })
  })

  it('a save that needs the sandbox confirmation keeps the user here', async () => {
    const { proceed, onSave, user } = mount()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByText('Switch PayPal to sandbox?')).toBeInTheDocument()
    expect(proceed).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  // redesign bugs F row 34: «Save and leave» that needs the sandbox confirmation waits for the answer: Use sandbox saves and
  // lets go, Cancel keeps the user here
  it('F34: Save and leave, then Use sandbox: saves once and lets go once', async () => {
    const { proceed, onSave, user } = mount()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const leave = await screen.findByRole('alertdialog', { name: 'Unsaved changes' })
    await user.click(within(leave).getByRole('button', { name: 'Save and leave' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Switch PayPal to sandbox?' })
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Use sandbox' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ sandbox: true })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  // the same wait covers the other direction (D-84: Sandbox -> Live asks too)
  it('F34: Save and leave, then Use live: saves once and lets go once', async () => {
    const { proceed, onSave, user } = mount({ businessPaymethod: record({ sandbox: true }) })
    await user.click(screen.getByRole('button', { name: 'Live' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const leave = await screen.findByRole('alertdialog', { name: 'Unsaved changes' })
    await user.click(within(leave).getByRole('button', { name: 'Save and leave' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Switch PayPal to live?' })
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Use live' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ sandbox: false })
  })

  it('F34: Save and leave, then Cancel the sandbox dialog: nothing is saved and the user stays', async () => {
    const { proceed, onSave, user } = mount()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const leave = await screen.findByRole('alertdialog', { name: 'Unsaved changes' })
    await user.click(within(leave).getByRole('button', { name: 'Save and leave' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Switch PayPal to sandbox?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(proceed).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    // the focus goes back to where the person asked to leave
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leave' })).toHaveFocus())
    // the draft is still sandbox and unsaved
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('F34: a failed save after Use sandbox keeps the user here', async () => {
    const { proceed, onSave, user } = mount()
    onSave.mockResolvedValue({ ok: false, error: ['Boom'] })
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const leave = await screen.findByRole('alertdialog', { name: 'Unsaved changes' })
    await user.click(within(leave).getByRole('button', { name: 'Save and leave' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Switch PayPal to sandbox?' })
    await user.click(within(confirm).getByRole('button', { name: 'Use sandbox' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(proceed).not.toHaveBeenCalled()
  })

  it('a save with missing required fields keeps the user here and shows the errors', async () => {
    const { proceed, onSave, user } = mount()
    await replaceText(user, input(live(), /^Client ID/), '')
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByText('Client ID is required')).toBeInTheDocument()
    expect(proceed).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Discard and leave resets the draft and lets go', async () => {
    const { proceed, user } = mount()
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Discard and leave' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
  })
})

// redesign stores 5.11: three opt-in additions (a field `readOnly`, `draftPatch`, `extraFields` + `extraValues`)
describe('readOnly fields (5.11)', () => {
  it('reaches the input of a plain field and of a secret, which keeps its Show', async () => {
    const { user } = setup({
      fields: [
        { key: 'account', label: 'Account', mode: 'live', readOnly: true },
        { key: 'token', label: 'Token', mode: 'live', secret: true, readOnly: true },
        { key: 'free', label: 'Free', mode: 'live' }
      ],
      businessPaymethod: record({ data: { account: 'acct_1', token: 'tok', free: 'x' } })
    })
    expect(input(live(), 'Account')).toHaveAttribute('readonly')
    expect(input(live(), 'Token')).toHaveAttribute('readonly')
    expect(input(live(), 'Free')).not.toHaveAttribute('readonly')
    await user.click(within(live()).getByRole('button', { name: /^Show/ }))
    expect(input(live(), 'Token')).toHaveAttribute('type', 'text')
  })

  it('reaches a number field', () => {
    setup({
      fields: [{ key: 'timeout', label: 'Timeout', mode: 'live', number: { min: 0 }, readOnly: true }],
      showMode: false,
      businessPaymethod: record({ data: { timeout: '10' } })
    })
    const field = screen.getByLabelText('Timeout')
    expect(field).toHaveAttribute('aria-roledescription', 'Number field')
    expect(field).toHaveAttribute('readonly')
  })

  it('is never required: no mark, no block, even when it is empty', async () => {
    const { user, onSave } = setup({
      fields: [
        { key: 'account', label: 'Account', mode: 'live', required: true, readOnly: true },
        { key: 'free', label: 'Free', mode: 'live' }
      ],
      businessPaymethod: record({ data: {} })
    })
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    await user.type(input(live(), 'Free'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Account is required')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith({ data: { free: 'x' } })
  })

  it('without readOnly nothing changes: no readonly attribute, the required mark stays', () => {
    setup()
    expect(input(live(), /^Client ID/)).not.toHaveAttribute('readonly')
    expect(input(live(), 'Client secret')).not.toHaveAttribute('readonly')
    expect(within(live()).getByText('Required')).toBeInTheDocument()
  })
})

describe('draftPatch (5.11)', () => {
  const panel = (onSave, patch, extra = {}) => <ProviderPanel {...baseProps()} onSave={onSave} draftPatch={patch} {...extra} />

  it('a patch on the first render is in the draft as unsaved changes, and Save sends it', async () => {
    const { user, onSave } = setup({ draftPatch: { data: { client_secret: 'from-oauth' } } })
    expect(input(live(), 'Client secret')).toHaveValue('from-oauth')
    expect(screen.getByRole('group', { name: 'PayPal' })).toHaveTextContent('1 unsaved change')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: 'from-oauth' } })
  })

  it('replaces sandbox and shallow-merges data and data_sandbox', async () => {
    const { user, onSave } = setup({
      businessPaymethod: record({ enabled: false }),
      draftPatch: { sandbox: true, data: { client_id: 'acct_9' }, data_sandbox: { client_secret: 'test-new' } }
    })
    expect(screen.getByText('Test mode: no real payments are taken.')).toBeInTheDocument()
    expect(input(live(), /^Client ID/)).toHaveValue('acct_9')
    expect(input(live(), 'Client secret')).toHaveValue('live-secret')
    expect(input(sandbox(), 'Client secret')).toHaveValue('test-new')
    expect(screen.getByRole('group', { name: 'PayPal' })).toHaveTextContent('3 unsaved changes')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({
      sandbox: true,
      data: { client_id: 'acct_9', client_secret: 'live-secret' },
      data_sandbox: { client_id: 'test-id', client_secret: 'test-new' }
    })
  })

  it('a new object that arrives later is applied; the same object again is not, even after the user typed over it', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(panel(onSave, undefined), { theme })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    const patch = { data: { client_secret: 'first' } }
    rerender(panel(onSave, patch))
    expect(input(live(), 'Client secret')).toHaveValue('first')
    await replaceText(user, input(live(), 'Client secret'), 'typed')
    rerender(panel(onSave, patch))
    expect(input(live(), 'Client secret')).toHaveValue('typed')
    rerender(panel(onSave, { data: { client_secret: 'second' } }))
    expect(input(live(), 'Client secret')).toHaveValue('second')
  })

  it('Discard drops the patch and it does not come back with the same object', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    const patch = { data: { client_secret: 'from-oauth' } }
    const { rerender } = renderWithProviders(panel(onSave, patch), { theme })
    expect(input(live(), 'Client secret')).toHaveValue('from-oauth')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(input(live(), 'Client secret')).toHaveValue('live-secret')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    rerender(panel(onSave, patch))
    expect(input(live(), 'Client secret')).toHaveValue('live-secret')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('after a good save the patch is the baseline: no changes are left', async () => {
    const { user, onSave } = setup({ draftPatch: { data: { client_secret: 'from-oauth' } } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sandbox' }))
    await user.click(screen.getByRole('button', { name: 'Live' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('null and undefined do nothing', () => {
    const { unmount } = setup({ draftPatch: null })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    unmount()
    setup({ draftPatch: undefined })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('a patch is merged into the draft only: the leave guard counts it', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    const proceed = vi.fn()
    const Host = () => {
      const { context, requestLeave, dialog } = useLeaveGuardHost()
      return (
        <LeaveGuardContext.Provider value={context}>
          <ProviderPanel {...baseProps()} onSave={onSave} draftPatch={{ data: { client_secret: 'from-oauth' } }} />
          <button type='button' onClick={() => requestLeave(proceed)}>Leave</button>
          <LeaveDialog {...dialog} title='Unsaved changes' keepLabel='Keep editing' saveLabel='Save and leave' discardLabel='Discard and leave' closeLabel='Close' description='You have unsaved changes' />
        </LeaveGuardContext.Provider>
      )
    }
    renderWithProviders(<Host />, { theme })
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(proceed).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })
})

describe('extraFields and extraValues (5.11)', () => {
  const EXTRA_FIELDS = [
    { key: 'fixed_fee', label: 'Fixed fee', number: { min: 0 }, hint: 'In the store currency' },
    { key: 'note', label: 'Note' }
  ]
  const withExtra = (props = {}) => ({ extraFields: EXTRA_FIELDS, extraValues: { fixed_fee: 1.5, note: null }, ...props })

  it('draws them in their own untitled group, after the credentials and before generalAfter', () => {
    setup(withExtra({ generalAfter: <p>After the fields</p> }))
    const fee = screen.getByLabelText('Fixed fee')
    const group = fee.closest('.odc-pp-group')
    expect(group).not.toBe(live())
    expect(group).not.toBe(sandbox())
    expect(group.querySelector('h4')).toBeNull()
    expect(group).not.toHaveAttribute('role')
    expect(group).toContainElement(screen.getByLabelText('Note'))
    expect(sandbox().compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(group.compareDocumentPosition(screen.getByText('After the fields')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a field with `number` is a NumberField with the saved value as text, and `min` gives a notice', () => {
    setup(withExtra({ extraValues: { fixed_fee: -3 } }))
    const fee = screen.getByLabelText('Fixed fee')
    expect(fee).toHaveAttribute('aria-roledescription', 'Number field')
    expect(fee).toHaveValue('-3')
    expect(screen.getByText('Usually 0 or more. Check this value.')).toBeInTheDocument()
    expect(screen.getByLabelText('Note')).toHaveValue('')
  })

  it('the hint of an extra field shows while it is in range', () => {
    setup(withExtra())
    expect(screen.getByLabelText('Fixed fee')).toHaveValue('1.5')
    expect(screen.getByText('In the store currency')).toBeInTheDocument()
  })

  it('they make the General tab exist on their own', () => {
    setup({ ...withExtra(), showMode: false, fields: [] })
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fixed fee')).toBeInTheDocument()
  })

  it('a change is counted and sent as changes.extra with ONLY the changed keys', async () => {
    const { user, onSave } = setup(withExtra())
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await replaceText(user, screen.getByLabelText('Note'), 'hello')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await replaceText(user, screen.getByLabelText('Fixed fee'), '2.5')
    expect(screen.getByRole('group', { name: 'PayPal' })).toHaveTextContent('2 unsaved changes')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ extra: { fixed_fee: '2.5', note: 'hello' } })
  })

  it('an emptied number field is sent as an empty string', async () => {
    const { user, onSave } = setup(withExtra())
    await replaceText(user, screen.getByLabelText('Fixed fee'), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ extra: { fixed_fee: '' } })
  })

  it('an extra change beside a credential change goes in the same call, and the credentials stay the full object', async () => {
    const { user, onSave } = setup(withExtra())
    await replaceText(user, input(live(), 'Client secret'), 'new-secret')
    await replaceText(user, screen.getByLabelText('Note'), 'n')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: 'new-secret' }, extra: { note: 'n' } })
  })

  it('Discard puts them back to the values they were made with', async () => {
    const { user, onSave } = setup(withExtra())
    await replaceText(user, screen.getByLabelText('Fixed fee'), '9')
    await replaceText(user, screen.getByLabelText('Note'), 'x')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Fixed fee')).toHaveValue('1.5')
    expect(screen.getByLabelText('Note')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('after a good save they are the baseline: the next save sends only what changed since', async () => {
    const { user, onSave } = setup(withExtra())
    await replaceText(user, screen.getByLabelText('Note'), 'one')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await replaceText(user, screen.getByLabelText('Fixed fee'), '4')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenLastCalledWith({ extra: { fixed_fee: '4' } })
  })

  it('a failed save keeps them in the draft', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: ['Bad fee'] })
    const { user } = setup(withExtra({ onSave }))
    await replaceText(user, screen.getByLabelText('Note'), 'kept')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad fee')
    expect(screen.getByLabelText('Note')).toHaveValue('kept')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('a readOnly and a secret extra field are drawn as such, and are never required', () => {
    setup(withExtra({
      extraFields: [
        { key: 'acct', label: 'Account', readOnly: true, required: true },
        { key: 'tok', label: 'Token', secret: true }
      ],
      extraValues: { acct: 'acct_1', tok: 'tok_1' }
    }))
    expect(screen.getByLabelText('Account')).toHaveAttribute('readonly')
    expect(within(screen.getByLabelText('Account').closest('.odc-pp-group')).queryByText('Required')).not.toBeInTheDocument()
    expect(input(screen.getByLabelText('Account').closest('.odc-pp-group'), 'Token')).toHaveAttribute('type', 'password')
  })

  it('without extraFields onSave never gets `extra`', async () => {
    const { user, onSave } = setup({ extraValues: { fixed_fee: 3 } })
    await replaceText(user, input(live(), 'Client secret'), 'z')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { client_id: 'live-id', client_secret: 'z' } })
  })
})
