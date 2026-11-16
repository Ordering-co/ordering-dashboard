/* eslint-disable import/first */
// redesign stores 5.13 (; E2): the detail of one business fee, one form held until «Save» in the save bar (as the customer
// fee of 5.12). Covered: the fields per kind (per order: delivery type, site, payment method, fixed, percentage; recurrent: period,
// day, fixed); «Recurrent» does not erase what was written for the other kind (S-3) and the payload sends null / 0 for it while it
// is recurrent; the checks are said in the form (name, amounts, percentage 0 to 100) and block the save; a failed save keeps the
// detail open with the reason in the bar; the payload of `main` (same keys); «Enabled» part of the form in edit mode and following
// the record; «Taxable» for level 0 only. The condition selects are the real P/SelectField: a combobox that opens a listbox
// of options, in the overlay host.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({ level: 0 }))

const mockModule = vi.hoisted(() => async () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `Q ${Number(value).toFixed(2)}` }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: probe.level } }]
}))
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))

import { BusinessFeeDetail, BusinessFeeForm, buildFeePayload, feeToForm } from '../index'

const DELIVERY = [
  { value: 'all', content: 'All delivery types' },
  { value: 'delivery', content: 'Delivery' },
  { value: 'pickup', content: 'Pickup' }
]
const SITES = [{ value: 'all', content: 'All sites' }, { value: 7, content: 'Main site' }]
const PAYMETHODS = [{ value: 'all', content: 'All payment methods' }, { value: 9, content: 'Cash' }]

const PER_ORDER = { id: 11, name: 'Service fee', description: 'Platform fee', fixed: 30, percentage: 2, enabled: true, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: null, recurring_day: null, taxable: true }
const WEEKLY = { id: 12, name: 'Monday rent', description: '', fixed: 15, percentage: 0, enabled: true, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: 'weekly', recurring_day: 1, taxable: true }
const MONTHLY = { id: 13, name: 'Monthly plan', description: '', fixed: 40, percentage: 0, enabled: true, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: 'monthly', recurring_day: 1, taxable: true }

let spies

const element = (fee, extra = {}) => (
  <BusinessFeeDetail
    fee={fee}
    deliveryTypeOptions={DELIVERY}
    siteOptions={SITES}
    paymethodOptions={PAYMETHODS}
    createFee={spies.createFee}
    updateFee={spies.updateFee}
    onSaved={spies.onSaved}
    onCreated={spies.onCreated}
    onClose={spies.onClose}
    {...extra}
  />
)
const renderDetail = (fee = null, extra) => renderWithProviders(element(fee, extra))

const bar = () => screen.queryByRole('group', { name: 'Save changes' })
const groupOf = (name) => screen.getByRole('group', { name })
// a P/SelectField: the combobox is named by its label and the chosen text; the listbox of options opens in the overlay host
const comboOf = (label) => screen.getByRole('combobox', { name: (name) => name.startsWith(label) })
const queryComboOf = (label) => screen.queryByRole('combobox', { name: (name) => name.startsWith(label) })
const openList = async (user, label) => {
  await user.click(comboOf(label))
  return screen.findByRole('listbox', { name: label, hidden: true })
}
const choose = async (user, label, option) => {
  const list = await openList(user, label)
  await user.click(within(list).getByRole('option', { name: option, hidden: true }))
}
const toggleRecurrent = (user) => user.click(screen.getByRole('switch', { name: 'Recurrent business fee' }))
const clickSave = (user, label = 'Add fee') => user.click(within(bar()).getByRole('button', { name: label }))
const typeName = (user, text) => user.type(screen.getByRole('textbox', { name: /Name/ }), text)

afterEach(() => document.getElementById('app-modals')?.remove())

beforeEach(() => {
  probe.level = 0
  spies = {
    createFee: vi.fn(async (payload) => ({ error: false, result: { id: 99, ...payload } })),
    updateFee: vi.fn(async (id, payload) => ({ error: false, result: { id, ...payload } })),
    onSaved: vi.fn(),
    onCreated: vi.fn(),
    onClose: vi.fn()
  }
})

describe('BusinessFeeDetail fields', () => {
  it('is also exported as BusinessFeeForm, the name the Stores index re-exports', () => {
    expect(BusinessFeeForm).toBe(BusinessFeeDetail)
  })

  it('a new per-order fee: name, description, the help of «Recurrent», the three conditions, fixed and percentage', () => {
    const { container } = renderDetail()
    expect(container.querySelector('form.odc-bf-form')).not.toBeNull()
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument()
    const recurrent = screen.getByRole('switch', { name: 'Recurrent business fee' })
    expect(recurrent.getAttribute('aria-checked')).toBe('false')
    const hint = document.getElementById(recurrent.getAttribute('aria-describedby'))
    expect(hint).toHaveTextContent("Charged every week or month with a fixed amount. Delivery type, site, payment method and percentage don't apply.")
    for (const label of ['Delivery type', 'Site', 'Payment method']) {
      const combo = comboOf(label)
      const labelNode = document.querySelector(`.odc-field-label[for="${combo.id}"]`)
      expect(labelNode.textContent).toContain(label)
    }
    expect(screen.getByRole('textbox', { name: 'Fixed amount' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Percentage (%)' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Recurring period' })).toBeNull()
    // a new fee has no «Enabled» (it is born enabled) and the bar waits for the first change
    expect(screen.queryByRole('switch', { name: 'Enabled' })).toBeNull()
    expect(bar()).toBeNull()
  })

  it('recurrent: the period, the day of the week and the fixed amount; no percentage, no conditions', async () => {
    const user = userEvent.setup()
    renderDetail()
    await toggleRecurrent(user)
    const period = groupOf('Recurring period')
    expect(within(period).getByRole('button', { name: 'Weekly' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(await openList(user, 'Day of week')).getAllByRole('option', { hidden: true })).toHaveLength(7)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('textbox', { name: 'Fixed amount' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Percentage (%)' })).toBeNull()
    expect(queryComboOf('Delivery type')).toBeNull()
    expect(queryComboOf('Site')).toBeNull()
    expect(queryComboOf('Payment method')).toBeNull()
    await user.click(within(period).getByRole('button', { name: 'Monthly' }))
    expect(queryComboOf('Day of week')).toBeNull()
    expect(within(await openList(user, 'Day of month')).getAllByRole('option', { hidden: true })).toHaveLength(31)
    await user.keyboard('{Escape}')
    // turning it on is one change, not one per hidden field
    expect(bar()).toHaveTextContent('1 unsaved change')
    expect(bar()).toHaveTextContent('Recurrent business fee')
  })

  it('«Taxable» is for level 0 only, and is still sent for the others', async () => {
    const user = userEvent.setup()
    probe.level = 1
    renderDetail()
    expect(screen.queryByRole('switch', { name: 'Taxable' })).toBeNull()
    await typeName(user, 'Plain')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '3')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0].taxable).toBe(true)
  })

  it('«Taxable» can be turned off by level 0 and is saved', async () => {
    const user = userEvent.setup()
    renderDetail()
    const taxable = screen.getByRole('switch', { name: 'Taxable' })
    expect(taxable.getAttribute('aria-checked')).toBe('true')
    await user.click(taxable)
    await typeName(user, 'Untaxed')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '3')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0].taxable).toBe(false)
  })
})

describe('BusinessFeeDetail «Recurrent» keeps what was written (S-3)', () => {
  it('turning it on sends null and 0 for the per-order values, and sends the period and the day', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Rent')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '7')
    await choose(user, 'Delivery type', 'Pickup')
    await choose(user, 'Site', 'Main site')
    await choose(user, 'Payment method', 'Cash')
    await toggleRecurrent(user)
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '20')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Rent',
      description: '',
      enabled: true,
      fixed: 20,
      percentage: 0,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recurring_period: 'weekly',
      recurring_day: 0,
      taxable: true
    }, { inlineError: true })
  })

  it('turning it off again brings the per-order values back, field and payload', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Mixed')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '7')
    await choose(user, 'Delivery type', 'Pickup')
    await choose(user, 'Site', 'Main site')
    await toggleRecurrent(user)
    await toggleRecurrent(user)
    expect(screen.getByRole('textbox', { name: 'Percentage (%)' })).toHaveValue('7')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0]).toMatchObject({
      fixed: 5,
      percentage: 7,
      delivery_type: 'pickup',
      site_id: 7,
      paymethod_id: null,
      recurring_period: null,
      recurring_day: null
    })
  })

  it('the day of the week and of the month are kept apart, and each period sends its own', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Plan')
    await toggleRecurrent(user)
    await choose(user, 'Day of week', 'Friday')
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Monthly' }))
    await choose(user, 'Day of month', '15')
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Weekly' }))
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '9')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0]).toMatchObject({ recurring_period: 'weekly', recurring_day: 5 })
  })

  it('choosing a period or a day only changes the draft: nothing is sent until Save', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Plan')
    await toggleRecurrent(user)
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '9')
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Monthly' }))
    await choose(user, 'Day of month', '20')
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Weekly' }))
    await choose(user, 'Day of week', 'Monday')
    expect(spies.createFee).not.toHaveBeenCalled()
    expect(bar()).toBeInTheDocument()
  })

  it('a monthly fee starts on day 1 and sends the day chosen', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Plan')
    await toggleRecurrent(user)
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Monthly' }))
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '9')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0]).toMatchObject({ recurring_period: 'monthly', recurring_day: 1 })
  })
})

describe('BusinessFeeDetail checks, said in the form', () => {
  it('requires a name', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await clickSave(user)
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(spies.createFee).not.toHaveBeenCalled()
  })

  it('a per-order fee needs a fixed amount or a percentage: it says so under the amount, in the form', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Empty')
    await clickSave(user)
    expect(spies.createFee).not.toHaveBeenCalled()
    expect(screen.getByText('Fee requires a fixed amount or percentage')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Fixed amount' }).getAttribute('aria-invalid')).toBe('true')
    // a percentage alone is enough
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '4')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
  })

  it('a recurrent fee needs a fixed amount above zero', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Rent')
    await toggleRecurrent(user)
    await clickSave(user)
    expect(spies.createFee).not.toHaveBeenCalled()
    expect(screen.getByText('Recurring fees require a fixed amount')).toBeInTheDocument()
    expect(screen.getByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('blocks a percentage outside 0 to 100 and says so under the field', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Late fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '120')
    expect(screen.getByText('Enter a percentage from 0 to 100.')).toBeInTheDocument()
    await clickSave(user)
    expect(spies.createFee).not.toHaveBeenCalled()
    expect(screen.getByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('a percentage left outside 0 to 100 while the fee is recurrent does not block it', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Rent')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '120')
    await toggleRecurrent(user)
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '10')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee.mock.calls[0][0]).toMatchObject({ percentage: 0, recurring_period: 'weekly' })
  })

  it('the name is limited to 100 characters', () => {
    renderDetail()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAttribute('maxlength', '500')
  })
})

describe('BusinessFeeDetail saving', () => {
  it('creates with the payload of main and hands the created fee over', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, '  Late fee ')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '3')
    await choose(user, 'Delivery type', 'Delivery')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Late fee',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 3,
      delivery_type: 'delivery',
      site_id: null,
      paymethod_id: null,
      recurring_period: null,
      recurring_day: null,
      taxable: true
    }, { inlineError: true })
    await waitFor(() => expect(spies.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 99, name: 'Late fee' })))
  })

  it('a failed save keeps the detail open: the reason in the bar, a retry, and what was written', async () => {
    const user = userEvent.setup()
    spies.createFee.mockResolvedValueOnce({ error: true, result: ['Fee requires a fixed amount or percentage'] })
    renderDetail()
    await typeName(user, 'Empty fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '1')
    await clickSave(user)
    expect(await within(bar()).findByRole('alert')).toHaveTextContent('Fee requires a fixed amount or percentage')
    expect(within(bar()).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Empty fee')
    expect(spies.onCreated).not.toHaveBeenCalled()
    expect(spies.onClose).not.toHaveBeenCalled()
    // the retry sends the same form again
    await user.click(within(bar()).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(spies.onCreated).toHaveBeenCalledTimes(1))
  })

  it('says the fallback text when the API gave no message', async () => {
    const user = userEvent.setup()
    spies.createFee.mockResolvedValueOnce({ error: true, result: [] })
    renderDetail()
    await typeName(user, 'Odd')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '1')
    await clickSave(user)
    expect(await within(bar()).findByRole('alert')).toHaveTextContent('The fee could not be saved.')
  })

  it('edits a recurrent fee: its values, the changed one named in the bar, the full payload, «Saved»', async () => {
    const user = userEvent.setup()
    const { rerender } = renderDetail(WEEKLY)
    expect(within(groupOf('Recurring period')).getByRole('button', { name: 'Weekly' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Recurrent business fee' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('textbox', { name: 'Fixed amount' })).toHaveValue('15')
    expect(bar()).toBeNull()
    expect(comboOf('Day of week')).toHaveAccessibleName('Day of week Monday')
    await choose(user, 'Day of week', 'Friday')
    expect(comboOf('Day of week')).toHaveAccessibleName('Day of week Friday')
    expect(bar()).toHaveTextContent('1 unsaved change')
    expect(bar()).toHaveTextContent('Day of week')
    await clickSave(user, 'Save changes')
    await waitFor(() => expect(spies.updateFee).toHaveBeenCalledTimes(1))
    expect(spies.updateFee).toHaveBeenCalledWith(12, {
      name: 'Monday rent',
      description: '',
      enabled: true,
      fixed: 15,
      percentage: 0,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recurring_period: 'weekly',
      recurring_day: 5,
      taxable: true
    }, { inlineError: true })
    await waitFor(() => expect(spies.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 12, recurring_day: 5 })))
    // the list follows the save (here the test is the list): the stored fee is the saved one, so nothing is pending and the bar says «Saved»
    rerender(element({ ...WEEKLY, recurring_day: 5 }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('edits a monthly fee on its own day', async () => {
    const user = userEvent.setup()
    renderDetail(MONTHLY)
    expect(within(groupOf('Recurring period')).getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe('true')
    await choose(user, 'Day of month', '15')
    await clickSave(user, 'Save changes')
    await waitFor(() => expect(spies.updateFee).toHaveBeenCalledTimes(1))
    expect(spies.updateFee.mock.calls[0][1]).toMatchObject({ recurring_period: 'monthly', recurring_day: 15 })
  })

  it('edits a per-order fee: «Enabled» is part of the form and saved with it', async () => {
    const user = userEvent.setup()
    renderDetail(PER_ORDER)
    expect(screen.getByRole('textbox', { name: 'Percentage (%)' })).toHaveValue('2')
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    expect(bar()).toHaveTextContent('Enabled')
    await clickSave(user, 'Save changes')
    await waitFor(() => expect(spies.updateFee).toHaveBeenCalledTimes(1))
    expect(spies.updateFee.mock.calls[0][1]).toMatchObject({ enabled: false, fixed: 30, percentage: 2, recurring_period: null })
  })

  it('puts the values back with Discard and takes the save bar away', async () => {
    const user = userEvent.setup()
    renderDetail(PER_ORDER)
    await typeName(user, ' extra')
    await toggleRecurrent(user)
    expect(bar()).toHaveTextContent('2 unsaved changes')
    await user.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Service fee')
    expect(screen.getByRole('switch', { name: 'Recurrent business fee' }).getAttribute('aria-checked')).toBe('false')
    expect(bar()).toBeNull()
    expect(spies.updateFee).not.toHaveBeenCalled()
  })

  it('follows the record: «Enabled» turned from the list moves the switch and is no change', async () => {
    const { rerender } = renderDetail(PER_ORDER)
    expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('true')
    rerender(element({ ...PER_ORDER, enabled: false }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('false'))
    expect(bar()).toBeNull()
  })
})

// lote B: what the condition selects put in the payload, pinned whatever the select is (same keys, same types)
describe('BusinessFeeDetail payload of the condition selects', () => {
  it('per order: the delivery type as text, the site and the payment method as the numbers of their options', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Payload fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '3')
    await choose(user, 'Delivery type', 'Pickup')
    await choose(user, 'Site', 'Main site')
    await choose(user, 'Payment method', 'Cash')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Payload fee',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 3,
      delivery_type: 'pickup',
      site_id: 7,
      paymethod_id: 9,
      recurring_period: null,
      recurring_day: null,
      taxable: true
    }, { inlineError: true })
  })

  it('per order: going back to «All …» sends null for that condition', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Back to all')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await choose(user, 'Site', 'Main site')
    await choose(user, 'Payment method', 'Cash')
    await choose(user, 'Payment method', 'All payment methods')
    await choose(user, 'Delivery type', 'Delivery')
    await choose(user, 'Delivery type', 'All delivery types')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Back to all',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 0,
      delivery_type: null,
      site_id: 7,
      paymethod_id: null,
      recurring_period: null,
      recurring_day: null,
      taxable: true
    }, { inlineError: true })
  })

  it('recurrent weekly: the day of the week goes as a number', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Weekly payload')
    await toggleRecurrent(user)
    await choose(user, 'Day of week', 'Friday')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '9')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Weekly payload',
      description: '',
      enabled: true,
      fixed: 9,
      percentage: 0,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recurring_period: 'weekly',
      recurring_day: 5,
      taxable: true
    }, { inlineError: true })
  })

  it('recurrent monthly: the day of the month goes as a number', async () => {
    const user = userEvent.setup()
    renderDetail()
    await typeName(user, 'Monthly payload')
    await toggleRecurrent(user)
    await user.click(within(groupOf('Recurring period')).getByRole('button', { name: 'Monthly' }))
    await choose(user, 'Day of month', '15')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '9')
    await clickSave(user)
    await waitFor(() => expect(spies.createFee).toHaveBeenCalledTimes(1))
    expect(spies.createFee).toHaveBeenCalledWith({
      name: 'Monthly payload',
      description: '',
      enabled: true,
      fixed: 9,
      percentage: 0,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recurring_period: 'monthly',
      recurring_day: 15,
      taxable: true
    }, { inlineError: true })
  })
})

describe('buildFeePayload and feeToForm', () => {
  it('round-trips a stored fee into the payload of main', () => {
    expect(buildFeePayload(feeToForm(PER_ORDER))).toEqual({
      name: 'Service fee',
      description: 'Platform fee',
      enabled: true,
      fixed: 30,
      percentage: 2,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recurring_period: null,
      recurring_day: null,
      taxable: true
    })
  })

  it('a stored fee without `taxable` is taxable', () => {
    const { taxable, ...rest } = PER_ORDER // eslint-disable-line no-unused-vars
    expect(buildFeePayload(feeToForm(rest)).taxable).toBe(true)
  })
})
