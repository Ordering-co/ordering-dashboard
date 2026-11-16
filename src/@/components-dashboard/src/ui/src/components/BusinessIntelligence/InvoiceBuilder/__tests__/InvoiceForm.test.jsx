/* eslint-disable import/first */
// redesign invoice FC1 (D7, D9, D12, D13; IV-06, IV-08, IV-10; auditor 7, 11, 12, 13): the form of the invoice page. It works
// against the controller contract with fake props (the controller of lot A is not imported): every field of `main` is there with
// an accessible name, a number writes to `setField` with the name `main` used, the period presets call `setPeriod` once, and the
// payment methods and order types are pills with a checklist.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  configs: {},
  catalog: {},
  parseDate: null
}))

vi.mock('../../../../../../index', async () => {
  const { getDateTimeFormats } = await import('../../../../../../utils/settingsCustomSections')
  return {
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (key, text) => mockState.catalog[key] ?? text],
    useConfig: () => [{ configs: mockState.configs }],
    // the project's date format, day part only, as the real parseDate does
    useUtils: () => [{
      parseDate: (date, options = {}) => {
        mockState.parseDate(date, options)
        const raw = mockState.configs.dates_general_format?.value
        const formats = getDateTimeFormats(typeof raw === 'string' && raw.trim() ? raw : 'DD MMM YYYY HH:mm')
        return dayjs(String(date).slice(0, 10)).format(options.dateOnly ? formats.dateFormat : `${formats.dateFormat} ${formats.timeFormat}`)
      }
    }]
  }
})

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { InvoiceForm } from '../InvoiceForm'

const BUSINESS_FORM = {
  type: 'charge',
  from: '',
  to: '',
  cancelled: false,
  discounts: false,
  notes: '',
  percentage_fee: 0,
  fixed_fee: 0,
  tax: 0,
  misc_amount: 0,
  misc_description: ''
}
const DRIVER_FORM = {
  from: '',
  to: '',
  cancelled: false,
  notes: '',
  percentage_fee: 0,
  fixed_fee: 0,
  percentage_delivery_price: 0,
  percentage_driver_tip: 0,
  tax: 0,
  misc_amount: 0,
  misc_description: ''
}

const makeProps = (kind, over = {}) => ({
  kind,
  form: kind === 'business' ? BUSINESS_FORM : DRIVER_FORM,
  setField: vi.fn(),
  setPeriod: vi.fn(),
  party: kind === 'business'
    ? {
        kind: 'business',
        items: [{ id: 1, name: 'Alpha Pizza' }, { id: 2, name: 'Beta Burgers' }],
        loading: false,
        error: null,
        page: 1,
        totalPages: 1,
        search: '',
        setSearch: vi.fn(),
        goToPage: vi.fn(),
        selected: null,
        select: vi.fn()
      }
    : {
        kind: 'driver',
        items: [{ id: 21, name: 'Ana Ruiz' }, { id: 22, name: 'Cy Díaz' }],
        loading: false,
        error: null,
        selected: null,
        select: vi.fn()
      },
  payMethods: {
    loading: false,
    error: null,
    retry: vi.fn(),
    items: [
      { id: 1, name: 'Cash', gateway: 'cash', checked: true },
      { id: 2, name: 'Card', gateway: 'stripe', checked: true },
      { id: 3, name: 'Card', gateway: 'paypal', checked: false }
    ],
    toggle: vi.fn(),
    setAll: vi.fn()
  },
  orderTypes: kind === 'business'
    ? {
        items: [
          { value: 1, name: 'Delivery', checked: true },
          { value: 2, name: 'Pickup', checked: true },
          { value: 3, name: 'Eat in', checked: false }
        ],
        toggle: vi.fn(),
        setAll: vi.fn()
      }
    : undefined,
  orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null },
  focusTarget: null,
  onFocusDone: vi.fn(),
  ...over
})

const wrap = (node) => (
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>{node}</ConfigFileContext.Provider>
)
const renderForm = (props) => render(wrap(<InvoiceForm {...props} />))

// A form that keeps what is written, as the controller does, and tells a spy what was sent
const Harness = ({ base, spy }) => {
  const [form, setForm] = useState(base.form)
  const setField = (name, value) => {
    spy(name, value)
    setForm(current => ({ ...current, [name]: value }))
  }
  return <InvoiceForm {...base} form={form} setField={setField} />
}

const EXIT = { timeout: 4000 }
const openPopup = async (user, name) => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  return screen.findByRole('dialog', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  mockState.catalog = {}
  mockState.parseDate = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

describe('InvoiceForm · the four sections', () => {
  it('business: Who and when, Fees, Which orders count and Notes, each with its h2, in this order', () => {
    renderForm(makeProps('business'))
    const headings = screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)
    expect(headings).toEqual(['Who and when', 'Fees', 'Which orders count', 'Notes'])
  })

  it('driver has the same four sections', () => {
    renderForm(makeProps('driver'))
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
      .toEqual(['Who and when', 'Fees', 'Which orders count', 'Notes'])
  })

  it('each section is a region named by its h2, and nothing is behind a «More»', () => {
    renderForm(makeProps('business'))
    ;['Who and when', 'Fees', 'Which orders count', 'Notes'].forEach(name => {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull()
  })

  it('uses the keys: the section titles are INVOICE_MANAGER_SECTION_* and Notes is the existing NOTES', () => {
    mockState.catalog = {
      INVOICE_MANAGER_SECTION_WHO: 'Quién y cuándo',
      INVOICE_MANAGER_SECTION_FEES: 'Tarifas',
      INVOICE_MANAGER_SECTION_ORDERS: 'Qué pedidos cuentan',
      NOTES: 'Notas'
    }
    renderForm(makeProps('business'))
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
      .toEqual(['Quién y cuándo', 'Tarifas', 'Qué pedidos cuentan', 'Notas'])
  })
})

describe('InvoiceForm · parity with main: every field is there and has a name', () => {
  it('business: type, period, business, commission, fixed fee, tax, other amount and its description, notes, canceled, discounts, methods and order types', () => {
    renderForm(makeProps('business'))
    expect(screen.getByRole('radiogroup', { name: 'Invoice type' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Charge the business commission and fees' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pay out the business' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Period/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Business/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Commission/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Fixed fee per order' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Tax/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Other amount' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Other amount description' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Include canceled orders/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Include discounts done by platform' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Payment methods/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Order types/ })).toBeInTheDocument()
    // only the driver has these
    expect(screen.queryByRole('textbox', { name: /Delivery fee/ })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Driver tip/ })).toBeNull()
  })

  it('driver: period, driver, commission, fixed fee, delivery fee %, driver tip %, tax, other amount and its description, notes, canceled, methods; no type, no discounts, no order types', () => {
    renderForm(makeProps('driver'))
    expect(screen.getByRole('button', { name: /^Period/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Driver/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Commission/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Fixed fee per order' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Delivery fee/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Driver tip/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Tax/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Other amount' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Other amount description' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Include canceled orders/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Payment methods/ })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Invoice type' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /discounts/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Order types/ })).toBeNull()
  })

  it('the invoice type shows the one in the form, and choosing the other writes `type` through setField', async () => {
    const user = userEvent.setup()
    const props = makeProps('business', { form: { ...BUSINESS_FORM, type: 'payout' } })
    renderForm(props)
    expect(screen.getByRole('radio', { name: 'Pay out the business' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Charge the business commission and fees' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('radio', { name: 'Charge the business commission and fees' }))
    expect(props.setField).toHaveBeenCalledWith('type', 'charge')
  })

  it('the old typo «commision» is gone and «MISC amount» is «Other amount» (IV-10, D12)', () => {
    renderForm(makeProps('business'))
    expect(document.body.textContent).not.toMatch(/commision/i)
    expect(document.body.textContent).not.toMatch(/MISC/)
    expect(document.body.textContent).not.toMatch(/Write a Notes/)
  })

  it('every control has an accessible name tied to a label, not a bare input (IV-06)', () => {
    renderForm(makeProps('driver'))
    const unnamed = [...document.querySelectorAll('input, textarea')]
      // the visually hidden inputs Base UI keeps for form submission are not controls (aria-hidden, out of the Tab order)
      .filter(node => node.type !== 'hidden' && node.getAttribute('aria-hidden') !== 'true')
      .filter(node => !node.labels?.length && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby'))
    expect(unnamed).toEqual([])
  })
})

describe('InvoiceForm · fees', () => {
  it('the commission says its unit and its help; the other numbers say their unit too', () => {
    renderForm(makeProps('driver'))
    const commission = screen.getByRole('textbox', { name: /^Commission/ })
    expect(commission).toHaveAccessibleName('Commission (%)')
    expect(commission).toHaveAccessibleDescription('Of the orders subtotal')
    expect(screen.getByRole('textbox', { name: /^Delivery fee/ })).toHaveAccessibleName('Delivery fee (%)')
    expect(screen.getByRole('textbox', { name: /^Driver tip/ })).toHaveAccessibleName('Driver tip (%)')
    expect(screen.getByRole('textbox', { name: /^Tax/ })).toHaveAccessibleName('Tax (%)')
  })

  it('shows the values of the form, strings included', () => {
    renderForm(makeProps('business', { form: { ...BUSINESS_FORM, percentage_fee: '12.5', fixed_fee: '2', tax: 8 } }))
    expect(screen.getByRole('textbox', { name: /^Commission/ })).toHaveValue('12.5')
    expect(screen.getByRole('textbox', { name: 'Fixed fee per order' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: /^Tax/ })).toHaveValue('8')
  })

  it.each([
    ['business', /^Commission/, 'percentage_fee'],
    ['business', 'Fixed fee per order', 'fixed_fee'],
    ['business', /^Tax/, 'tax'],
    ['business', 'Other amount', 'misc_amount'],
    ['driver', /^Commission/, 'percentage_fee'],
    ['driver', 'Fixed fee per order', 'fixed_fee'],
    ['driver', /^Delivery fee/, 'percentage_delivery_price'],
    ['driver', /^Driver tip/, 'percentage_driver_tip'],
    ['driver', /^Tax/, 'tax'],
    ['driver', 'Other amount', 'misc_amount']
  ])('%s · writing in «%s» calls setField(%s, <string>) with a value that keeps the decimals', async (kind, name, field) => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(wrap(<Harness base={makeProps(kind)} spy={spy} />))
    const input = screen.getByRole('textbox', { name })
    await user.clear(input)
    await user.type(input, '7.5')
    expect(spy).toHaveBeenLastCalledWith(field, '7.5')
    expect(spy.mock.calls.every(([sent, value]) => sent === field && typeof value === 'string')).toBe(true)
    expect(input).toHaveValue('7.5')
  })

  // redesign (row 1, invoice P6, D-25 b): the driver has no invoice type to turn the other amount around, so it takes a minus
  it('driver · the other amount takes a negative amount, says so, and the business one keeps its minimum of 0', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    const { unmount } = render(wrap(<Harness base={makeProps('driver')} spy={spy} />))
    const input = screen.getByRole('textbox', { name: 'Other amount' })
    expect(input).toHaveAccessibleDescription('A negative amount subtracts')
    // review F-1: the decimal keyboard of iOS has no minus key; Base UI picks `text` when the field has no minimum
    expect(input).not.toHaveAttribute('inputmode', 'decimal')
    await user.clear(input)
    await user.type(input, '-12.5')
    await user.tab()
    expect(spy).toHaveBeenLastCalledWith('misc_amount', '-12.5')
    expect(input).toHaveValue('-12.5')
    unmount()

    const business = vi.fn()
    render(wrap(<Harness base={makeProps('business')} spy={business} />))
    const field = screen.getByRole('textbox', { name: 'Other amount' })
    expect(field).not.toHaveAccessibleDescription('A negative amount subtracts')
    expect(field).toHaveAttribute('inputmode', 'decimal')
    await user.clear(field)
    await user.type(field, '-12.5')
    await user.tab()
    expect(business.mock.calls.some(([, value]) => String(value).startsWith('-'))).toBe(false)
  })

  it('an emptied number goes as an empty string (the calculation turns it into 0, D8), never NaN', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(wrap(<Harness base={makeProps('business', { form: { ...BUSINESS_FORM, tax: 5 } })} spy={spy} />))
    await user.clear(screen.getByRole('textbox', { name: /^Tax/ }))
    expect(spy).toHaveBeenLastCalledWith('tax', '')
    expect(spy.mock.calls.some(([, value]) => value === 'NaN')).toBe(false)
  })

  it('the other amount description and the notes write their own names', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(wrap(<Harness base={makeProps('business')} spy={spy} />))
    await user.type(screen.getByRole('textbox', { name: 'Other amount description' }), 'Setup')
    expect(spy).toHaveBeenLastCalledWith('misc_description', 'Setup')
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Thanks')
    expect(spy).toHaveBeenLastCalledWith('notes', 'Thanks')
  })

  it('the notes say what they are for', () => {
    renderForm(makeProps('business'))
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAccessibleDescription('Printed at the end of the invoice')
  })

  it('numbers are 0 or more, as in main (`min="0"`): a minus sign never reaches setField, and the decimal point does', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(wrap(<Harness base={makeProps('business')} spy={spy} />))
    const input = screen.getByRole('textbox', { name: /^Commission/ })
    expect(input).toHaveAttribute('inputmode', 'decimal') // a phone keyboard with the decimal point, as `type="number"` had
    await user.clear(input)
    await user.type(input, '-3')
    expect(spy.mock.calls.some(([, value]) => Number(value) < 0)).toBe(false)
  })
})

describe('InvoiceForm · the period', () => {
  const FIXED_NOW = '2026-10-10T12:00:00'
  const freeze = () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FIXED_NOW))
  }
  const openPeriod = async (user) => {
    await user.click(screen.getByRole('button', { name: /^Period/ }))
    return screen.findByRole('dialog', { name: 'Select a date' })
  }

  it('says «All dates» when both ends are empty, as main with no dates', () => {
    renderForm(makeProps('business'))
    const trigger = screen.getByRole('button', { name: /^Period/ })
    expect(trigger).toHaveTextContent('All dates')
    expect(trigger).toHaveAccessibleName('Period All dates')
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('says the dates with the project format, never ISO, and calls parseDate as the contract says (D10)', () => {
    renderForm(makeProps('business', { form: { ...BUSINESS_FORM, from: '2026-09-10', to: '2026-09-12' } }))
    const trigger = screen.getByRole('button', { name: /^Period/ })
    expect(trigger).toHaveTextContent('10-09-2026 – 12-09-2026')
    expect(trigger.textContent).not.toMatch(/2026-09/)
    expect(trigger.querySelector('bdi')).toHaveTextContent('10-09-2026 – 12-09-2026')
    expect(mockState.parseDate).toHaveBeenCalledWith('2026-09-10', { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' })
  })

  it('a single day is said once', () => {
    renderForm(makeProps('driver', { form: { ...DRIVER_FORM, from: '2026-09-10', to: '2026-09-10' } }))
    const trigger = screen.getByRole('button', { name: /^Period/ })
    expect(trigger).toHaveTextContent('10-09-2026')
    expect(trigger).not.toHaveTextContent('–')
  })

  it('the popover offers the five presets of main plus a custom range', async () => {
    const user = userEvent.setup()
    renderForm(makeProps('business'))
    const box = await openPeriod(user)
    const names = within(box).getAllByRole('button').map(button => button.textContent).filter(Boolean)
    ;['All dates', 'This month', 'Last month', 'Last 7 days', 'Last 30 days', 'Done'].forEach(name => expect(names).toContain(name))
  })

  it.each([
    ['This month', '2026-10-01', '2026-10-10'],
    ['Last month', '2026-09-01', '2026-09-30'],
    ['Last 7 days', '2026-10-04', '2026-10-10'],
    ['Last 30 days', '2026-09-11', '2026-10-10']
  ])('«%s» calls setPeriod(%s, %s) once, with the local day of today', async (label, from, to) => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    const props = makeProps('business')
    renderForm(props)
    const box = await openPeriod(user)
    await user.click(within(box).getByRole('button', { name: label }))
    expect(props.setPeriod).toHaveBeenCalledTimes(1)
    expect(props.setPeriod).toHaveBeenCalledWith(from, to)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
  })

  it('«All dates» calls setPeriod with two empty strings', async () => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    const props = makeProps('business', { form: { ...BUSINESS_FORM, from: '2026-09-10', to: '2026-09-12' } })
    renderForm(props)
    const box = await openPeriod(user)
    await user.click(within(box).getByRole('button', { name: 'All dates' }))
    expect(props.setPeriod).toHaveBeenCalledTimes(1)
    expect(props.setPeriod).toHaveBeenCalledWith('', '')
  })

  it('the preset that matches the form is the one that is pressed', async () => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    renderForm(makeProps('business', { form: { ...BUSINESS_FORM, from: '2026-09-01', to: '2026-09-30' } }))
    const box = await openPeriod(user)
    expect(within(box).getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(box).getByRole('button', { name: 'All dates' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('a custom range is a draft: it writes once, on «Done», and a day alone is a range of one day', async () => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    const props = makeProps('business')
    renderForm(props)
    const box = await openPeriod(user)
    await user.click(box.querySelector('[data-day="2026-10-02"]'))
    await user.click(box.querySelector('[data-day="2026-10-05"]'))
    expect(props.setPeriod).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(props.setPeriod).toHaveBeenCalledTimes(1)
    expect(props.setPeriod).toHaveBeenCalledWith('2026-10-02', '2026-10-05')
  })

  it('a single day picked and «Done» is that day as a range of one', async () => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    const props = makeProps('driver')
    renderForm(props)
    const box = await openPeriod(user)
    await user.click(box.querySelector('[data-day="2026-10-02"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(props.setPeriod).toHaveBeenCalledTimes(1)
    expect(props.setPeriod).toHaveBeenCalledWith('2026-10-02', '2026-10-02')
  })

  it('leaving with Escape applies nothing', async () => {
    freeze()
    const user = userEvent.setup({ advanceTimers: () => {} })
    const props = makeProps('business')
    renderForm(props)
    const box = await openPeriod(user)
    await user.click(box.querySelector('[data-day="2026-10-02"]'))
    await user.keyboard('{Escape}')
    expect(props.setPeriod).not.toHaveBeenCalled()
  })

  it('the period comes before the business, as the auditor asks (so a big load is not asked for first)', () => {
    renderForm(makeProps('business'))
    const period = screen.getByRole('button', { name: /^Period/ })
    const business = screen.getByRole('button', { name: /^Business/ })
    expect(period.compareDocumentPosition(business) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('InvoiceForm · which orders count', () => {
  it('says what counts, with the help of D9, and a «Which states?» button that lists the real states of the business', async () => {
    const user = userEvent.setup()
    renderForm(makeProps('business'))
    expect(screen.getByText('Orders in billable states paid with these methods and of these types.')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Which states?' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: 'Which states?' })
    expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Pending',
      'Completed by admin',
      'Accepted by business',
      'Accepted by driver',
      'Pick up completed by driver',
      'Delivery completed by driver',
      'Order picked up completed by customer'
    ])
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Which states?' })).toBeNull()
  })

  it('driver: the two states of main, and the canceled ones join when the box is on', async () => {
    const user = userEvent.setup()
    const { rerender } = renderForm(makeProps('driver'))
    await user.click(screen.getByRole('button', { name: 'Which states?' }))
    const names = () => within(screen.getByRole('list', { name: 'Which states?' })).getAllByRole('listitem').map(item => item.textContent)
    expect(names()).toEqual(['Completed by admin', 'Delivery completed by driver'])
    rerender(wrap(<InvoiceForm {...makeProps('driver', { form: { ...DRIVER_FORM, cancelled: true } })} />))
    expect(names()).toEqual([
      'Completed by admin',
      'Delivery completed by driver',
      'Rejected',
      'Rejected by business',
      'Rejected by driver',
      'Pick up failed by driver',
      'Delivery failed by driver'
    ])
  })

  it('the state names come from the project dictionary, as the PDF reads them', async () => {
    const user = userEvent.setup()
    renderForm(makeProps('driver'))
    await user.click(screen.getByRole('button', { name: 'Which states?' }))
    expect(screen.getByRole('list', { name: 'Which states?' })).toHaveTextContent('Completed by admin')
  })

  it('«Include canceled orders» writes `cancelled`; the business says «Includes every status, as before»', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    const box = screen.getByRole('checkbox', { name: /Include canceled orders/ })
    expect(box).toHaveAttribute('aria-checked', 'false')
    expect(box).toHaveAccessibleDescription('Includes every status, as before')
    await user.click(box)
    expect(props.setField).toHaveBeenCalledWith('cancelled', true)
  })

  it('the driver\'s canceled box has no such note', () => {
    renderForm(makeProps('driver'))
    expect(screen.queryByText('Includes every status, as before')).toBeNull()
  })

  it('«Include discounts done by platform» writes `discounts` (business only)', async () => {
    const user = userEvent.setup()
    const props = makeProps('business', { form: { ...BUSINESS_FORM, discounts: true } })
    renderForm(props)
    const box = screen.getByRole('checkbox', { name: 'Include discounts done by platform' })
    expect(box).toHaveAttribute('aria-checked', 'true')
    await user.click(box)
    expect(props.setField).toHaveBeenCalledWith('discounts', false)
  })

  it('every change applies at once: there is no «Save» button (D1)', () => {
    renderForm(makeProps('business'))
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })
})

describe('InvoiceForm · payment methods', () => {
  it('is a pill that says «All» when all are on, «N of M» when some are, «None» when none are', () => {
    const items = (checks) => checks.map((checked, index) => ({ id: index + 1, name: `M${index + 1}`, gateway: 'g', checked }))
    const { rerender } = renderForm(makeProps('driver', { payMethods: { ...makeProps('driver').payMethods, items: items([true, true, true]) } }))
    const pill = () => screen.getByRole('button', { name: /^Payment methods/ })
    expect(pill()).toHaveTextContent('All')
    rerender(wrap(<InvoiceForm {...makeProps('driver', { payMethods: { ...makeProps('driver').payMethods, items: items([true, false, true]) } })} />))
    expect(pill()).toHaveTextContent('2 of 3')
    expect(pill().querySelectorAll('bdi.odc-figure')).toHaveLength(2)
    rerender(wrap(<InvoiceForm {...makeProps('driver', { payMethods: { ...makeProps('driver').payMethods, items: items([false, false, false]) } })} />))
    expect(pill()).toHaveTextContent('None')
  })

  it('lists one row per id, and unticking one calls toggle(id)', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    const popup = await openPopup(user, 'Payment methods')
    expect(within(popup).getAllByRole('checkbox')).toHaveLength(3)
    await user.click(within(popup).getByRole('checkbox', { name: /Cash/ }))
    expect(props.payMethods.toggle).toHaveBeenCalledTimes(1)
    expect(props.payMethods.toggle).toHaveBeenCalledWith(1)
  })

  it('two methods with the same name are told apart by their gateway', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    const popup = await openPopup(user, 'Payment methods')
    const rows = within(popup).getAllByRole('checkbox')
    const names = rows.map(row => row.textContent)
    expect(names).toContain('Cash')
    expect(names).toContain('Card stripe')
    expect(names).toContain('Card paypal')
    expect(new Set(names).size).toBe(3)
    await user.click(within(popup).getByRole('checkbox', { name: /Card paypal/ }))
    expect(props.payMethods.toggle).toHaveBeenCalledWith(3)
  })

  it('«Clear» puts them all back on, setAll(true)', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    const popup = await openPopup(user, 'Payment methods')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(props.payMethods.setAll).toHaveBeenCalledWith(true)
  })

  it('an error says so in words and «Try again» is payMethods.retry; the raw message is never shown', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    props.payMethods = { ...props.payMethods, error: 'Invalid response format', items: [] }
    renderForm(props)
    expect(screen.getByText('The payment methods could not be loaded.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Invalid response format/)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.payMethods.retry).toHaveBeenCalledTimes(1)
  })

  it('while they load, the pill is there but says nothing yet, and the popover says «Loading»', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    props.payMethods = { ...props.payMethods, loading: true, items: [] }
    renderForm(props)
    const pill = screen.getByRole('button', { name: /^Payment methods/ })
    expect(pill).not.toHaveTextContent('All')
    const popup = await openPopup(user, 'Payment methods')
    expect(within(popup).getByText('Loading')).toBeInTheDocument()
  })
})

describe('InvoiceForm · order types (business)', () => {
  it('is a pill with «N of M» and a checklist that calls toggle(value)', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    expect(screen.getByRole('button', { name: /^Order types/ })).toHaveTextContent('2 of 3')
    const popup = await openPopup(user, 'Order types')
    expect(within(popup).getAllByRole('checkbox').map(row => row.textContent)).toEqual(['Delivery', 'Pickup', 'Eat in'])
    await user.click(within(popup).getByRole('checkbox', { name: 'Eat in' }))
    expect(props.orderTypes.toggle).toHaveBeenCalledWith(3)
  })

  it('«Clear» puts them all back on', async () => {
    const user = userEvent.setup()
    const props = makeProps('business')
    renderForm(props)
    const popup = await openPopup(user, 'Order types')
    await user.click(within(popup).getByRole('button', { name: 'Clear' }))
    expect(props.orderTypes.setAll).toHaveBeenCalledWith(true)
  })

  it('blocked = no_order_types shows «No order types selected» beside the pill', () => {
    const props = makeProps('business', { orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'no_order_types' } })
    props.orderTypes = { ...props.orderTypes, items: props.orderTypes.items.map(item => ({ ...item, checked: false })) }
    renderForm(props)
    expect(screen.getByRole('status')).toHaveTextContent('No order types selected')
    expect(screen.getByRole('button', { name: /^Order types/ })).toHaveTextContent('None')
  })

  it('shows no such notice otherwise', () => {
    renderForm(makeProps('business'))
    expect(screen.queryByText('No order types selected')).toBeNull()
  })
})

describe('InvoiceForm · focusTarget (⌘K)', () => {
  it('payment_methods: scrolls to the section, focuses the pill of the methods and says it is done, once', async () => {
    const props = makeProps('business', { focusTarget: 'payment_methods' })
    renderForm(props)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Payment methods/ })).toHaveFocus())
    expect(props.onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('order_type: focuses the pill of the order types', async () => {
    const props = makeProps('business', { focusTarget: 'order_type' })
    renderForm(props)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Order types/ })).toHaveFocus())
    expect(props.onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('general: focuses the first field, the period', async () => {
    const props = makeProps('driver', { focusTarget: 'general' })
    renderForm(props)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Period/ })).toHaveFocus())
    expect(props.onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('a driver has no order types: the target falls back to the section, which can take the focus', async () => {
    const props = makeProps('driver', { focusTarget: 'order_type' })
    renderForm(props)
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Which orders count' })).toHaveFocus())
    expect(props.onFocusDone).toHaveBeenCalledTimes(1)
  })

  it('scrolls the section into view when the browser can', async () => {
    const scrollIntoView = vi.fn()
    const original = window.HTMLElement.prototype.scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    try {
      const props = makeProps('business', { focusTarget: 'payment_methods' })
      renderForm(props)
      await waitFor(() => expect(props.onFocusDone).toHaveBeenCalled())
      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      window.HTMLElement.prototype.scrollIntoView = original
    }
  })

  it('without a target nothing takes the focus and onFocusDone is not called', () => {
    const props = makeProps('business')
    renderForm(props)
    expect(props.onFocusDone).not.toHaveBeenCalled()
    expect(document.body).toHaveFocus()
  })
})

// The layout cannot be measured in jsdom: the sheet says what it promises.
describe('invoice-form.css', () => {
  const read = async () => readFileSync(path.resolve(__dirname, '../invoice-form.css'), 'utf8')

  it('uses tokens only: no color, length, weight or duration literal, and no z-index number', async () => {
    const css = (await read()).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|container)[^{]*\{/g, '{')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/:[^;{}]*\b\d+(\.\d+)?(px|rem|em|ms|s)\b/)
    expect(css).not.toMatch(/font-weight:\s*\d/)
    expect(css).not.toMatch(/z-index:\s*-?\d/)
  })

  it('has a single column on a phone and two columns of fields only where there is room', async () => {
    const css = await read()
    // one column is the base; two come from the width of the form itself (a container, BREAKPOINT_CONTAINER_NARROW = 600)
    expect(css).toMatch(/\.odc-iv-fields\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/)
    expect(css).toMatch(/@container odc-iv-form \(min-width: 600px\)\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    // the phone rules use the breakpoint of the stylesheets of the dashboard
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)/)
  })

  it('gives its triggers the 44 px area on a phone through the house token', async () => {
    const css = await read()
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)[\s\S]*inset:\s*var\(--od-x-target-inset\)/)
  })

  // redesign invoice AC (B2): the touch probe of the audit found 4 controls under 44 px and 4 crossings on /intelligence/invoice
  // at 390, and the first guess was the radios of «Invoice type». They are not it (measured in Chromium at 390 with the real sheets and
  // this DOM: both radios are 358 x 44, native <button>s, and pass). The four are the hidden inputs of the four fee fields. Base UI draws
  // a hidden <input> (aria-hidden, tabindex -1, 1 px, clipped) beside every number field, radio and checkbox. With a `name` (the fee
  // fields have one) a NumberField's is `position: absolute` with no offsets, so it sits at the corner of its field as a visible 1 px box;
  // the radios', the checkboxes' and a nameless field's are `position: fixed; top: 0; left: 0`, at the corner of the window, which the
  // probe does not sample. The probe counts every visible input: the points 21 px from the 1 px box land on the real field, so it
  // reads 4 failures and 4 crossings (one per fee field). Nobody can touch, focus or hear them: the sheet takes them out of the box tree.
  describe('the hidden inputs of Base UI (B2)', () => {
    const hiddenRule = async () => {
      const css = (await read()).replace(/\/\*[\s\S]*?\*\//g, '')
      const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, , body]) => /display:\s*none\s*!important/.test(body))
      return rule ? rule[1].trim() : null
    }

    it('a business invoice has eight of them in the form: two radios, four named fee fields and two checkboxes, all aria-hidden and out of the tab order', () => {
      renderForm(makeProps('business'))
      const form = document.querySelector('.odc-iv-form')
      const inputs = [...form.querySelectorAll('input[aria-hidden="true"]')]
      expect(inputs.map(input => input.type).sort()).toEqual(['checkbox', 'checkbox', 'number', 'number', 'number', 'number', 'radio', 'radio'])
      inputs.forEach(input => expect(input).toHaveAttribute('tabindex', '-1'))
      // the four with a name are the ones that sit inside their field (position: absolute); they are the four of the probe
      expect(inputs.filter(input => input.type === 'number').map(input => input.name)).toEqual(['percentage_fee', 'fixed_fee', 'tax', 'misc_amount'])
      // the controls themselves are the buttons and the visible fields, which the probe measures at their real box
      expect(screen.getAllByRole('radio')).toHaveLength(2)
      screen.getAllByRole('radio').forEach(radio => expect(radio.tagName).toBe('BUTTON'))
      screen.getAllByRole('checkbox').forEach(box => expect(box.tagName).toBe('BUTTON'))
    })

    it('the sheet takes every hidden input of the form out of the box tree, and nothing a person can touch', async () => {
      const selector = await hiddenRule()
      expect(selector).not.toBeNull()
      renderForm(makeProps('business'))
      const form = document.querySelector('.odc-iv-form')
      const hidden = [...form.querySelectorAll('input[aria-hidden="true"]')]
      // the selector is scoped to the form and catches all eight
      expect(selector.startsWith('.odc-iv-form ')).toBe(true)
      expect(hidden).toHaveLength(8)
      hidden.forEach(input => expect(input.matches(selector)).toBe(true))
      // and nothing a person can touch: no button, no visible field (the number fields' own inputs included), no checkbox button
      const touchable = [...form.querySelectorAll('button, textarea, input:not([aria-hidden="true"])')]
      expect(touchable.length).toBeGreaterThan(8)
      expect(touchable.some(node => node.tagName === 'INPUT')).toBe(true)
      touchable.forEach(node => expect(node.matches(selector)).toBe(false))
    })

    it('leaves the radios as they are: the sheet of the form has no rule for .odc-radio, so the 44 px of radio-group.css stand', async () => {
      const css = (await read()).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css).not.toMatch(/\.odc-radio/)
      const radios = readFileSync(path.resolve(__dirname, '../../../Shared/Product/radio-group.css'), 'utf8')
      expect(radios).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{\s*\.odc-radio\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    })
  })

  it('uses logical properties only', async () => {
    const css = (await read()).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|container)[^{]*\{/g, '{')
    expect(css).not.toMatch(/\b(margin|padding)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(?<![-\w])(left|right|top|bottom):/)
    expect(css).not.toMatch(/(?<![-\w])(width|height|min-width|max-width|min-height|max-height):/)
  })
})
