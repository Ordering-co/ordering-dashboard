// redesign invoice FA (D8, auditor 1, auditor 10): the fixed data of the invoice tests (invoiceMath, InvoiceBuilder).
// Every order is a different rule of the arithmetic of `main`; the comment above each one says which.

export const ROOT = 'https://api.test/v400/en/dev'

export const BUSINESS = { id: 7, name: 'Pizza Palace' }
export const DRIVER = { id: 9, name: 'Dana Driver' }

/** The configs the controllers read: decimals as the text the API sends, order types 1|2|3, no wallet. */
export const CONFIGS = {
  format_number_decimal_length: { value: '2' },
  order_types_allowed: { value: '1|2|3' },
  wallet_cash_enabled: { value: '0' },
  wallet_credit_point_enabled: { value: '0' }
}

/** What GET /paymethods answers (id 4 is disabled and 5 is one of the gateways `filterPaymethods` never hid). */
export const PAYMETHODS_API = [
  { id: 1, name: 'Cash', gateway: 'cash', enabled: true },
  { id: 2, name: 'Card', gateway: 'stripe', enabled: true },
  { id: 3, name: 'PayPal', gateway: 'paypal', enabled: true },
  { id: 4, name: 'Old method', gateway: 'cash', enabled: false },
  { id: 5, name: 'Apple Pay', gateway: 'apple_pay', enabled: true }
]

/** The methods both invoices list: the enabled ones (D13: `filterPaymethods` of the business hides nothing). */
export const PAYMETHODS_ENABLED = PAYMETHODS_API.filter(method => method.enabled)

const summary = (subtotal, tax, discount, serviceFee, driverTip, total) => ({
  subtotal, tax, discount, service_fee: serviceFee, driver_tip: driverTip, total
})

const order = (id, patch) => ({
  id,
  business_id: BUSINESS.id,
  driver_id: DRIVER.id,
  delivery_datetime: '2026-09-10 12:00:00',
  status: 1,
  paymethod_id: 1,
  payment_events: [],
  delivery_type: 1,
  delivery_zone_price: 0,
  discount: 0,
  tax: 0,
  tax_type: 2,
  service_fee: 0,
  driver_tip: 0,
  taxes: [],
  products: [],
  summary: summary(10, 1, 0, 0, 0, 11),
  ...patch
})

export const ORDERS = [
  // with summary, tax not included in the price
  order(101, { delivery_datetime: '2026-09-05 12:00:00', delivery_zone_price: 6, summary: summary(100, 10, 5, 3, 4, 118) }),
  // an included product tax (type 1, target product) is added to the subtotal; pickup (2)
  order(102, {
    delivery_datetime: '2026-09-20 18:30:00',
    status: 11,
    paymethod_id: 2,
    delivery_type: 2,
    tax_type: 1,
    taxes: [{ type: 1, target: 'product', summary: { tax: 2.5 } }],
    summary: summary(50.5, 0, 0, 0, 0, 50.5)
  }),
  // last day of the period at 23:59; paid with PayPal (3); tax included and `taxes` empty: the summary tax is added; eat in (3)
  order(103, {
    delivery_datetime: '2026-09-30 23:59:00',
    status: 7,
    paymethod_id: 3,
    delivery_type: 3,
    tax_type: 1,
    delivery_zone_price: 2,
    summary: summary(20, 2, 1, 1, 1, 23)
  }),
  // a pending order (status 0): the business bills it (D7), the driver does not
  order(104, { delivery_datetime: '2026-09-10 08:00:00', status: 0, delivery_zone_price: 3, summary: summary(30, 3, 0, 0, 0, 33) }),
  // a cancelled order (status 2): neither invoice counts it without «cancelled»
  order(105, { delivery_datetime: '2026-09-12 13:00:00', status: 2, summary: summary(40, 4, 4, 0, 0, 36) }),
  // D1: its own method (99) is in no list and its only payment event is PayPal (3); the event also keeps it in the
  // business invoice when PayPal is not checked
  order(106, {
    delivery_datetime: '2026-09-15 20:00:00',
    paymethod_id: 99,
    payment_events: [{ paymethod: { id: 3 } }],
    delivery_zone_price: 4,
    summary: summary(60, 6, 0, 0, 0, 66)
  }),
  // no `summary`: the subtotal comes from the products and their options (10 + options 7) x 2 = 34
  order(107, {
    delivery_datetime: '2026-09-18 11:00:00',
    summary: undefined,
    discount: 1,
    tax: 10,
    service_fee: 5,
    driver_tip: 10,
    delivery_zone_price: 3,
    products: [{
      price: 10,
      quantity: 2,
      options: [
        { allow_suboptionQuantity: true, suboptions: [{ price: 1.5, quantity: 2 }, { price: 2 }] },
        { with_half_option: true, suboptions: [{ price: 4, half_price: 2, position: 'left' }] }
      ]
    }]
  }),
  // before the period of the date cases
  order(108, { delivery_datetime: '2026-08-15 10:00:00', summary: summary(15, 1.5, 0, 0, 0, 16.5) }),
  // D10: no `summary` and `delivery_type` as the string '2' (the business filter compares numbers, so only the driver sees it)
  order(109, {
    delivery_datetime: '2026-09-25 10:00:00',
    delivery_type: '2',
    summary: undefined,
    discount: 2,
    tax: 5,
    service_fee: 2,
    driver_tip: 5,
    delivery_zone_price: 4,
    products: [{ price: 12.35, quantity: 3 }]
  }),
  // status 8: billable for the business, not for the driver
  order(110, { delivery_datetime: '2026-09-26 10:00:00', status: 8, paymethod_id: 2, summary: summary(25, 2.5, 0, 0, 0, 27.5) })
]

/** The ids of a list of orders, to read an expectation at a glance. */
export const idsOf = (orders) => orders.map(item => item.id)

export const DEFAULT_BUSINESS_FORM = {
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

export const DEFAULT_DRIVER_FORM = {
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
