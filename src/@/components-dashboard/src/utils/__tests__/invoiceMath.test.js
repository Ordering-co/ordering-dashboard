/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign invoice FA (D8, auditor 1, auditor 10): the arithmetic of /intelligence/invoice.
// The invoices of `invoiceMath` are compared field by field with the ones the controllers of `main`
// (InvoiceBusinessManager, InvoiceDriverManager) build for the same data, so no amount can drift.
// (owner decision D-71) changed D1, D2, D10, D11 and D22 on purpose: the cases they touch left the comparison
// with `main` and are hand computed in «the fixes of », each with what `main` gives next to it.

const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))
const configState = vi.hoisted(() => ({ value: null }))

vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: configState.value }] }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))

import { InvoiceBusinessManager } from '../../components/InvoiceBusinessManager'
import { InvoiceDriverManager } from '../../components/InvoiceDriverManager'
import {
  buildBusinessInvoice,
  buildDriverInvoice,
  businessOrdersWhere,
  driverOrdersWhere,
  escapeNotes,
  orderDiscount,
  orderDriverTip,
  orderIncludedTaxes,
  orderServiceFee,
  orderSubtotal,
  orderTax,
  orderTotal,
  roundPrice,
  serverFilterIds,
  toAmount
} from '../invoiceMath'
import {
  BUSINESS,
  CONFIGS,
  DEFAULT_BUSINESS_FORM,
  DEFAULT_DRIVER_FORM,
  DRIVER,
  ORDERS,
  PAYMETHODS_API,
  PAYMETHODS_ENABLED,
  ROOT,
  idsOf
} from './fixtures/invoiceOrders'

const PAGINATION = { current_page: 1, page_size: 10, total_pages: 1, total: 1 }

const captured = { where: null }

const json = (body) => Promise.resolve({ json: async () => body })

const makeOrdersChain = () => {
  const chain = {
    asDashboard: () => chain,
    where: (where) => {
      captured.where = where
      return chain
    },
    get: async () => ({ content: { error: false, result: ORDERS, pagination: { total: ORDERS.length } } })
  }
  return chain
}

const makeUsersChain = () => {
  const chain = {
    asDashboard: () => chain,
    select: () => chain,
    where: () => chain,
    get: async () => ({ content: { error: false, result: [DRIVER], pagination: PAGINATION } })
  }
  return chain
}

beforeEach(() => {
  captured.where = null
  session.value = { token: 'token-1', loading: false, user: { id: 1, level: 0 } }
  ordering.value = { root: ROOT, orders: makeOrdersChain, users: makeUsersChain }
  configState.value = CONFIGS
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (url.includes('/backoffice/businesses')) return json({ error: false, result: [BUSINESS], pagination: PAGINATION })
    if (url.endsWith('/paymethods')) return json({ error: false, result: PAYMETHODS_API })
    return json({ error: true, result: ['unexpected url ' + url] })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---- `main`, mounted as it is -------------------------------------------------------------------------------

const mountMain = async (Controller, isReady) => {
  const ui = { current: null }
  const UIComponent = (props) => {
    ui.current = props
    return null
  }
  render(<Controller UIComponent={UIComponent} />)
  await waitFor(() => expect(isReady(ui.current)).toBe(true))
  return ui
}

/** The invoice and the `where` the business controller of `main` builds for a form and the lists checked in its two tabs. */
const businessMain = async ({ form = {}, uncheckedPay = null, uncheckedTypes = null, serverTypes = null } = {}) => {
  const ui = await mountMain(
    InvoiceBusinessManager,
    (props) => props?.payMethodsList.data.length > 0 && props.businessList.businesses.length > 0 && props.orderTypes.length > 0
  )
  await act(async () => {
    ui.current.handleChangeInvocing({ ...ui.current.invocing, ...DEFAULT_BUSINESS_FORM, ...form, business: BUSINESS.id })
  })
  if (uncheckedPay) {
    await act(async () => {
      ui.current.handleChangePayMethods(ui.current.payMethodsList.data.map(method => ({ ...method, enabled: !uncheckedPay.includes(method.id) })))
    })
  }
  if (uncheckedTypes) {
    await act(async () => {
      ui.current.handleChangeOrderTypes(ui.current.orderTypes.map(type => ({ ...type, enabled: !uncheckedTypes.includes(type.value) })))
    })
  }
  if (serverTypes) {
    await act(async () => {
      ui.current.handleChangeDeliveryTypes(serverTypes)
    })
  }
  await act(async () => {
    await ui.current.getOrders()
  })
  return { invoice: ui.current.exportInvoiceList.invoice, where: captured.where, ui }
}

const driverMain = async ({ form = {}, uncheckedPay = null, wallet = null } = {}) => {
  if (wallet) configState.value = { ...CONFIGS, ...wallet }
  const ui = await mountMain(
    InvoiceDriverManager,
    (props) => props?.payMethodsList.data.length > 0 && props.driverList.drivers.length > 0
  )
  await act(async () => {
    ui.current.handleChangeInvocing({ ...ui.current.invocing, ...DEFAULT_DRIVER_FORM, ...form, driver: DRIVER.id })
  })
  if (uncheckedPay) {
    await act(async () => {
      ui.current.handleChangePayMethods(ui.current.payMethodsList.data.map(method => ({ ...method, enabled: !uncheckedPay.includes(method.id) })))
    })
  }
  await act(async () => {
    await ui.current.getOrders()
  })
  return { invoice: ui.current.exportInvoiceList.invoice, where: captured.where, ui }
}

// ---- `invoiceMath`, with the same data ----------------------------------------------------------------------

const payItems = (uncheckedIds = []) => PAYMETHODS_ENABLED.map(method => ({
  id: method.id, name: method.name, gateway: method.gateway, checked: !uncheckedIds.includes(method.id)
}))

const typeItems = (uncheckedValues = []) => [1, 2, 3].map(value => ({ value, name: `type ${value}`, checked: !uncheckedValues.includes(value) }))

const businessMine = ({ form = {}, uncheckedPay = [], uncheckedTypes = [] } = {}) => buildBusinessInvoice({
  orders: ORDERS,
  form: { ...DEFAULT_BUSINESS_FORM, ...form },
  payMethods: payItems(uncheckedPay),
  orderTypes: typeItems(uncheckedTypes),
  business: BUSINESS,
  decimals: CONFIGS.format_number_decimal_length.value
})

const driverMine = ({ form = {}, uncheckedPay = [], walletEnabled = false } = {}) => buildDriverInvoice({
  orders: ORDERS,
  form: { ...DEFAULT_DRIVER_FORM, ...form },
  payMethods: payItems(uncheckedPay),
  driver: DRIVER,
  decimals: CONFIGS.format_number_decimal_length.value,
  walletEnabled
})

/** The numbers of the form that the PDF prints come out of `invoiceMath` already converted (D4); `main` echoes the field as typed. */
const ECHOED_NUMBERS = ['percentage_fee', 'fixed_fee', 'tax', 'misc_amount', 'percentage_delivery_price', 'percentage_driver_tip']
const asConverted = (invoice) => {
  const out = { ...invoice }
  ECHOED_NUMBERS.forEach((key) => {
    if (key in out && typeof out[key] !== 'number') out[key] = Number(out[key]) || 0
  })
  return out
}

describe('invoiceMath: pure pieces', () => {
  it('toAmount: empty, null, undefined and not numeric are 0; a number or a numeric text is a number', () => {
    expect(toAmount('')).toBe(0)
    expect(toAmount(null)).toBe(0)
    expect(toAmount(undefined)).toBe(0)
    expect(toAmount('abc')).toBe(0)
    expect(toAmount('7.5')).toBe(7.5)
    expect(toAmount(3)).toBe(3)
    expect(toAmount('-2')).toBe(-2)
    expect(toAmount(NaN)).toBe(0)
  })

  it('escapeNotes: escapes & < > " \' and then turns every line break into <br>', () => {
    expect(escapeNotes('<b>a</b>\nb')).toBe('&lt;b&gt;a&lt;/b&gt;<br>b')
    expect(escapeNotes('Tom & "Jerry" it\'s')).toBe('Tom &amp; &quot;Jerry&quot; it&#39;s')
    expect(escapeNotes('one\ntwo\nthree')).toBe('one<br>two<br>three')
    expect(escapeNotes('')).toBe('')
  })

  it('serverFilterIds: the checked ids only when some but not all are checked, in the order of the list', () => {
    const items = [{ id: 1, checked: true }, { id: 2, checked: true }, { id: 3, checked: true }]
    expect(serverFilterIds(items, 'id')).toEqual([])
    expect(serverFilterIds(items.map(item => ({ ...item, checked: false })), 'id')).toEqual([])
    expect(serverFilterIds([{ id: 1, checked: true }, { id: 2, checked: false }, { id: 3, checked: true }], 'id')).toEqual([1, 3])
    expect(serverFilterIds([{ id: 5, checked: false }, { id: 2, checked: true }, { id: 9, checked: false }], 'id')).toEqual([2])
    expect(serverFilterIds([{ value: 1, checked: false }, { value: 2, checked: true }], 'value')).toEqual([2])
    expect(serverFilterIds([], 'id')).toEqual([])
    expect(serverFilterIds(undefined, 'id')).toEqual([])
  })

  it('an order without summary: subtotal from products and options, then tax, discount, fee, tip and total (hand computed)', () => {
    const order = ORDERS.find(item => item.id === 107)
    // (10 + options (1.5 x 2) + 2 + half price 2) x 2
    expect(orderSubtotal(order, '2')).toBe(34)
    expect(orderTax(order, '2')).toBe(3.3)
    expect(orderDiscount(order, '2')).toBe(1)
    expect(orderServiceFee(order, '2')).toBe(1.65)
    expect(orderDriverTip(order, '2')).toBe(3.3)
    expect(orderTotal(order, '2')).toBe(44.25)
    expect(roundPrice(1.005, 2)).toBe(1)
    expect(roundPrice(2.346, '2')).toBe(2.35)
  })

  it('an order with summary: the summary values, plus the included taxes in the subtotal', () => {
    const withTaxes = ORDERS.find(item => item.id === 102)
    const withoutTaxes = ORDERS.find(item => item.id === 103)
    const plain = ORDERS.find(item => item.id === 101)
    expect(orderSubtotal(withTaxes, 2)).toBe(53)
    expect(orderIncludedTaxes(withTaxes)).toBe(2.5)
    expect(orderSubtotal(withoutTaxes, 2)).toBe(22)
    expect(orderSubtotal(plain, 2)).toBe(100)
    expect(orderTotal(plain, 2)).toBe(118)
    expect(orderTax(plain, 2)).toBe(10)
    expect(orderDiscount(plain, 2)).toBe(5)
    expect(orderServiceFee(plain, 2)).toBe(3)
    expect(orderDriverTip(plain, 2)).toBe(4)
  })

  it('D10 fixed: a pickup without summary adds no delivery price and no tip, whether delivery_type is 2 or the text "2"', () => {
    const order = ORDERS.find(item => item.id === 109)
    // 12.35 x 3 = 37.05; tax 5 % of 35.05 = 1.75; fee 2 % of 35.05 = 0.70; minus the discount 2
    expect(orderTotal(order, 2)).toBe(37.5)
    expect(orderTotal({ ...order, delivery_type: 2 }, 2)).toBe(37.5)
    // a delivery adds its price (4) and the tip (5 % of 35.05 = 1.75)
    expect(orderTotal({ ...order, delivery_type: 1 }, 2)).toBe(43.25)
  })
})

describe('invoiceMath: the orders request', () => {
  it('businessOrdersWhere is the where of main, in the same order, and adds delivery_type and paymethod_id only when not empty', () => {
    expect(businessOrdersWhere({ businessId: 7, from: '', to: '', deliveryTypeIds: [], paymethodIds: [] })).toEqual([
      { attribute: 'business_id', value: 7 }
    ])
    expect(businessOrdersWhere({ businessId: 7, from: '2026-09-01', to: '2026-09-30', deliveryTypeIds: [1, 3], paymethodIds: [1, 5] })).toEqual([
      { attribute: 'business_id', value: 7 },
      { attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-09-01 00:00:00' } },
      { attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-09-30 23:59:59' } },
      { attribute: 'delivery_type', value: [1, 3] },
      { attribute: 'paymethod_id', value: [1, 5] }
    ])
  })

  it('driverOrdersWhere is the where of main, in the same order', () => {
    expect(driverOrdersWhere({ driverId: 9, from: '2026-09-01', to: '', paymethodIds: [2] })).toEqual([
      { attribute: 'driver_id', value: 9 },
      { attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-09-01 00:00:00' } },
      { attribute: 'paymethod_id', value: [2] }
    ])
    expect(driverOrdersWhere({ driverId: 9, from: '', to: '', paymethodIds: [] })).toEqual([{ attribute: 'driver_id', value: 9 }])
  })

  it('the where equals the one the business controller of main sends (captured from the mock)', async () => {
    const withFilters = await businessMain({
      form: { from: '2026-09-01', to: '2026-09-30' },
      uncheckedPay: [2],
      serverTypes: [1, 3]
    })
    expect(withFilters.where).toEqual(businessOrdersWhere({
      businessId: BUSINESS.id, from: '2026-09-01', to: '2026-09-30', deliveryTypeIds: [1, 3], paymethodIds: [1, 3, 5]
    }))
  })

  it('the where equals the one main sends with no dates and no filters', async () => {
    const plain = await businessMain()
    expect(plain.where).toEqual(businessOrdersWhere({ businessId: BUSINESS.id, from: '', to: '', deliveryTypeIds: [], paymethodIds: [] }))
  })

  it('the where equals the one the driver controller of main sends', async () => {
    const withFilters = await driverMain({ form: { from: '2026-09-01', to: '2026-09-30' }, uncheckedPay: [3] })
    expect(withFilters.where).toEqual(driverOrdersWhere({ driverId: DRIVER.id, from: '2026-09-01', to: '2026-09-30', paymethodIds: [1, 2, 5] }))
  })
})

describe('business invoice: field by field against InvoiceBusinessManager of main', () => {
  // [name, options, ids of the orders the invoice counts]
  const cases = [
    ['default: all checked, no dates', {}, [101, 102, 103, 104, 106, 107, 108, 110]],
    ['with dates', { form: { from: '2026-09-01', to: '2026-09-30' } }, [101, 102, 103, 104, 106, 107, 110]],
    ['only the first day', { form: { from: '2026-09-05', to: '2026-09-05' } }, [101]],
    ['payout with fees, tax and misc', {
      form: { type: 'payout', percentage_fee: 10, fixed_fee: 1.5, tax: 7, misc_amount: 5, misc_description: 'Bonus' }
    }, [101, 102, 103, 104, 106, 107, 108, 110]],
    ['charge with fees, tax and misc', {
      form: { type: 'charge', percentage_fee: 12.5, fixed_fee: 2, tax: 8.25, misc_amount: 9.99, misc_description: 'Setup' }
    }, [101, 102, 103, 104, 106, 107, 108, 110]],
    ['with discounts (charge)', { form: { discounts: true, percentage_fee: 10 } }, [101, 102, 103, 104, 106, 107, 108, 110]],
    ['with discounts (payout)', { form: { discounts: true, type: 'payout', percentage_fee: 10, tax: 5 } }, [101, 102, 103, 104, 106, 107, 108, 110]],
    ['with cancelled', { form: { cancelled: true } }, [101, 102, 103, 104, 105, 106, 107, 108, 110]],
    ['an order type unchecked', { uncheckedTypes: [1] }, [102, 103]],
    ['no order type checked', { uncheckedTypes: [1, 2, 3] }, []],
    ['plain notes', { form: { notes: 'Pay within 30 days\nThanks' } }, [101, 102, 103, 104, 106, 107, 108, 110]]
  ]

  it.each(cases)('%s', async (name, options, ids) => {
    const main = await businessMain(options)
    const mine = businessMine(options)
    expect(idsOf(main.invoice.orders)).toEqual(ids)
    expect(idsOf(mine.orders)).toEqual(ids)
    expect(mine).toEqual(asConverted(main.invoice))
    expect(mine.business).toEqual(BUSINESS)
  })

  it('the money of the default case is the sum of the orders (hand computed)', () => {
    const mine = businessMine()
    // subtotals: 100 + 53 (50.5 + 2.5 included) + 22 (20 + 2 included) + 30 + 60 + 34 + 15 + 25
    expect(mine.orders_subtotal).toBe(339)
    // totals: 118 + 50.5 + 23 + 33 + 66 + 44.25 + 16.5 + 27.5
    expect(mine.orders_total).toBe(378.75)
    // a charge with no fees bills nothing
    expect(mine.subtotal).toBe(0)
    expect(mine.total).toBe(0)
    const charged = businessMine({ form: { percentage_fee: 10, fixed_fee: 2, tax: 10 } })
    expect(charged.percentage_fee_total).toBeCloseTo(33.9, 10)
    expect(charged.fixed_fee_total).toBe(16)
    expect(charged.subtotal).toBeCloseTo(49.9, 10)
    expect(charged.total).toBeCloseTo(54.89, 10)
  })

  it('payout takes the fees as negative and adds the orders subtotal and the product tax', () => {
    const mine = businessMine({ form: { type: 'payout', percentage_fee: 10, fixed_fee: 1, misc_amount: 5 } })
    const subtotal = mine.orders_subtotal
    expect(mine.percentage_fee_total).toBeCloseTo(-subtotal * 10 / 100, 10)
    expect(mine.fixed_fee_total).toBe(-1 * mine.orders.length)
    expect(mine.misc_amount).toBe(-5)
    expect(mine.subtotal).toBeCloseTo(mine.percentage_fee_total + mine.fixed_fee_total + mine.misc_amount + mine.tax_products + subtotal, 10)
  })

  it('numbers typed in the fields (texts) give the same invoice as the numbers', async () => {
    const asText = { percentage_fee: '10', fixed_fee: '1.5', tax: '7', misc_amount: '5' }
    const main = await businessMain({ form: asText })
    const mine = businessMine({ form: asText })
    expect(mine).toEqual(asConverted(main.invoice))
    expect(mine).toEqual(businessMine({ form: { percentage_fee: 10, fixed_fee: 1.5, tax: 7, misc_amount: 5 } }))
  })

  it('D4: an empty tax is 0 and the total is a number (in main it is NaN)', async () => {
    const main = await businessMain({ form: { percentage_fee: 10, tax: '' } })
    expect(Number.isNaN(main.invoice.total)).toBe(true)
    const mine = businessMine({ form: { percentage_fee: 10, tax: '' } })
    expect(Number.isFinite(mine.total)).toBe(true)
    expect(mine.tax).toBe(0)
    expect(mine.total).toBe(businessMine({ form: { percentage_fee: 10, tax: 0 } }).total)
    expect(mine.total).toBe(main.invoice.subtotal)
  })

  it('D4: an empty fee or misc amount is 0 and nothing is NaN', () => {
    const mine = businessMine({ form: { percentage_fee: '', fixed_fee: '', misc_amount: '', tax: '' } })
    Object.entries(mine).forEach(([key, value]) => {
      if (typeof value === 'number') expect(Number.isNaN(value), key).toBe(false)
    })
    expect(mine.percentage_fee).toBe(0)
  })

  it('D14: HTML in the notes is escaped and the line breaks become <br>', async () => {
    const mine = businessMine({ form: { notes: '<b>a</b>\nb' } })
    expect(mine.notes).toBe('&lt;b&gt;a&lt;/b&gt;<br>b')
    const main = await businessMain({ form: { notes: '<b>a</b>\nb' } })
    expect(main.invoice.notes).toBe('<b>a</b><br>b')
  })

  it('the name of the business comes from the argument, with no list', () => {
    const mine = buildBusinessInvoice({
      orders: ORDERS, form: DEFAULT_BUSINESS_FORM, payMethods: payItems(), orderTypes: typeItems(), business: { id: 99, name: 'Other' }, decimals: 2
    })
    expect(mine.business).toEqual({ id: 99, name: 'Other' })
  })
})

describe('driver invoice: field by field against InvoiceDriverManager of main', () => {
  const cases = [
    ['default: all checked, no dates', {}, [101, 102, 106, 107, 108, 109]],
    ['with dates', { form: { from: '2026-09-01', to: '2026-09-30' } }, [101, 102, 106, 107, 109]],
    ['with all the fees', {
      form: { percentage_fee: 10, fixed_fee: 1.5, percentage_delivery_price: 50, percentage_driver_tip: 25, tax: 7, misc_amount: 5, misc_description: 'Bonus' }
    }, [101, 102, 106, 107, 108, 109]],
    ['with cancelled', { form: { cancelled: true } }, [101, 102, 105, 106, 107, 108, 109]],
    ['D1 for the driver: an unchecked method drops the orders paid only with it', { uncheckedPay: [3] }, [101, 102, 107, 108, 109]],
    ['no payment method checked', { uncheckedPay: [1, 2, 3, 5] }, []],
    ['plain notes', { form: { notes: 'Thanks\nSee you' } }, [101, 102, 106, 107, 108, 109]]
  ]

  it.each(cases)('%s', async (name, options, ids) => {
    const main = await driverMain(options)
    const mine = driverMine(options)
    expect(idsOf(main.invoice.orders)).toEqual(ids)
    expect(idsOf(mine.orders)).toEqual(ids)
    expect(mine).toEqual(asConverted(main.invoice))
    expect(mine.driver).toEqual(DRIVER)
  })

  it('numbers typed in the fields (texts) give the same invoice as the numbers', async () => {
    const asText = { percentage_fee: '10', fixed_fee: '1.5', percentage_delivery_price: '50', percentage_driver_tip: '25', tax: '7', misc_amount: '5' }
    const main = await driverMain({ form: asText })
    const mine = driverMine({ form: asText })
    expect(mine).toEqual(asConverted(main.invoice))
  })

  it('D4: an empty tax or misc amount is 0 and the total is a number (in main it is NaN)', async () => {
    const main = await driverMain({ form: { percentage_fee: 10, tax: '', misc_amount: '' } })
    expect(Number.isNaN(main.invoice.total)).toBe(true)
    expect(Number.isNaN(main.invoice.subtotal)).toBe(true)
    const mine = driverMine({ form: { percentage_fee: 10, tax: '', misc_amount: '' } })
    expect(Number.isFinite(mine.total)).toBe(true)
    expect(mine.total).toBe(driverMine({ form: { percentage_fee: 10 } }).total)
  })

  it('D4/D11: a misc amount typed as "0" is the number 0 (so the PDF does not print its row)', async () => {
    const main = await driverMain({ form: { misc_amount: '0' } })
    expect(main.invoice.misc_amount).toBe('0')
    expect(driverMine({ form: { misc_amount: '0' } }).misc_amount).toBe(0)
  })

  it('D14: HTML in the notes is escaped', () => {
    expect(driverMine({ form: { notes: '<img src=x onerror=1>\nok' } }).notes).toBe('&lt;img src=x onerror=1&gt;<br>ok')
  })

  it('the delivery price and the tip percentages are taken as `main` does when the summary has no delivery price (delivery_zone_price, tip from summary)', () => {
    const mine = driverMine({ form: { percentage_delivery_price: 100, percentage_driver_tip: 100 } })
    const orders = mine.orders
    const deliveryPrice = orders.reduce((sum, item) => sum + item.delivery_zone_price, 0)
    const tip = orders.reduce((sum, item) => sum + orderDriverTip(item, 2), 0)
    expect(mine.percentage_delivery_price_total).toBe(deliveryPrice)
    expect(mine.percentage_driver_tip_total).toBe(tip)
  })
})

describe('the fixes of (hand computed; `main` gives the other figure)', () => {
  const walletOrder = (id, patch = {}) => ({ ...ORDERS[0], id, paymethod_id: 99, payment_events: [{ wallet_event: { wallet_id: 5 } }], ...patch })

  it('D1: an order whose only payment event is an unchecked method is dropped (main kept it)', async () => {
    const main = await businessMain({ uncheckedPay: [3] })
    expect(idsOf(main.invoice.orders)).toEqual([101, 102, 104, 106, 107, 108, 110])
    expect(idsOf(businessMine({ uncheckedPay: [3] }).orders)).toEqual([101, 102, 104, 107, 108, 110])
    // with PayPal checked the same order counts
    expect(idsOf(businessMine().orders)).toContain(106)
  })

  it('D1: with no payment method checked nothing passes (main let every order with a payment event pass)', async () => {
    const main = await businessMain({ uncheckedPay: [1, 2, 3, 5] })
    expect(idsOf(main.invoice.orders)).toEqual([106])
    expect(idsOf(businessMine({ uncheckedPay: [1, 2, 3, 5] }).orders)).toEqual([])
  })

  it('D1: an order paid with the wallet still passes the payment method filter of the business', () => {
    const invoice = buildBusinessInvoice({
      orders: [walletOrder(201), walletOrder(202, { payment_events: [{ data: { wallet_currency: 'credit_points' } }] }), walletOrder(203, { payment_events: [{ paymethod: { id: 3 } }] })],
      form: DEFAULT_BUSINESS_FORM,
      payMethods: payItems([1, 2, 3, 5]),
      orderTypes: typeItems(),
      business: BUSINESS,
      decimals: 2
    })
    expect(idsOf(invoice.orders)).toEqual([201, 202])
  })

  it('D2: with a wallet enabled the status, payment method and cancelled filters still run (main skipped them)', async () => {
    const wallet = { wallet: { wallet_cash_enabled: { value: '1' } }, walletEnabled: true }
    const main = await driverMain(wallet)
    expect(idsOf(main.invoice.orders)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110])
    const mine = driverMine(wallet)
    expect(idsOf(mine.orders)).toEqual([101, 102, 106, 107, 108, 109])
    expect(mine).toEqual(driverMine())
  })

  it('D2: with dates and the points wallet, the same filters plus the period', () => {
    const mine = driverMine({ walletEnabled: true, form: { from: '2026-09-01', to: '2026-09-30' } })
    expect(idsOf(mine.orders)).toEqual([101, 102, 106, 107, 109])
  })

  it('D2: a wallet payment passes the method filter of the driver only with a wallet enabled', () => {
    const orders = [walletOrder(201), walletOrder(202, { status: 2 })]
    const build = (walletEnabled, form = {}) => buildDriverInvoice({
      orders, form: { ...DEFAULT_DRIVER_FORM, ...form }, payMethods: payItems([1, 2, 3, 5]), driver: DRIVER, decimals: 2, walletEnabled
    })
    expect(idsOf(build(true).orders)).toEqual([201])
    expect(idsOf(build(true, { cancelled: true }).orders)).toEqual([201, 202])
    expect(idsOf(build(false).orders)).toEqual([])
  })

  // redesign (row 1, invoice P6, D-25 b): the form now lets the driver's other amount be negative; the sum already took it as it is
  it('a negative other amount of the driver subtracts from the subtotal and the tax', () => {
    const plain = driverMine({ form: { percentage_fee: 10, tax: 10 } })
    const minus = driverMine({ form: { percentage_fee: 10, tax: 10, misc_amount: '-5' } })
    expect(minus.misc_amount).toBe(-5)
    expect(minus.subtotal).toBeCloseTo(plain.subtotal - 5, 6)
    expect(minus.total).toBeCloseTo(plain.total - 5.5, 6)
  })

  it('D10: a pickup without summary in the driver invoice adds no delivery price or tip to the orders total', () => {
    const pickup = { ...ORDERS.find(item => item.id === 109), id: 209, delivery_type: 2 }
    const invoice = buildDriverInvoice({ orders: [pickup], form: DEFAULT_DRIVER_FORM, payMethods: payItems(), driver: DRIVER, decimals: 2, walletEnabled: false })
    expect(invoice.orders_total).toBe(37.5)
  })

  it('D11: the delivery price percentage reads summary.delivery_price (main read delivery_zone_price: NaN when missing)', () => {
    const orders = [
      { ...ORDERS[0], id: 211, delivery_zone_price: null, summary: { ...ORDERS[0].summary, delivery_price: 8 } },
      { ...ORDERS[0], id: 212, delivery_zone_price: 6, summary: { ...ORDERS[0].summary, delivery_price: 5 } },
      { ...ORDERS[0], id: 213, delivery_zone_price: 3, summary: undefined, products: [{ price: 10, quantity: 1 }] }
    ]
    const invoice = buildDriverInvoice({
      orders, form: { ...DEFAULT_DRIVER_FORM, percentage_delivery_price: 50 }, payMethods: payItems(), driver: DRIVER, decimals: 2, walletEnabled: false
    })
    // (8 + 5 + 3) x 50 %
    expect(invoice.percentage_delivery_price_total).toBe(8)
    expect(Number.isFinite(invoice.total)).toBe(true)
  })

  it('D22: with no order type to choose from, the type does not filter (main billed 0 orders)', () => {
    const invoice = buildBusinessInvoice({
      orders: ORDERS, form: DEFAULT_BUSINESS_FORM, payMethods: payItems(), orderTypes: [], business: BUSINESS, decimals: 2
    })
    expect(idsOf(invoice.orders)).toEqual([101, 102, 103, 104, 106, 107, 108, 109, 110])
    // with the list, no type checked still bills nothing, as in main
    expect(idsOf(businessMine({ uncheckedTypes: [1, 2, 3] }).orders)).toEqual([])
  })

  it('D12 kept (who pays a platform discount is a question for the team): a charge with discounts lowers the base and subtracts the discount', () => {
    const order = { ...ORDERS[0], id: 221, summary: { subtotal: 100, tax: 0, discount: 20, service_fee: 0, driver_tip: 0, total: 80 } }
    const invoice = buildBusinessInvoice({
      orders: [order], form: { ...DEFAULT_BUSINESS_FORM, discounts: true, percentage_fee: 10 }, payMethods: payItems(), orderTypes: typeItems(), business: BUSINESS, decimals: 2
    })
    expect(invoice.percentage_fee_total).toBe(8)
    expect(invoice.subtotal).toBe(-12)
  })
})
