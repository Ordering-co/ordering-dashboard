// redesign invoice FA (D8, auditor 1, auditor 10): the invoice arithmetic of /intelligence/invoice, pure and without React.
//
// It reproduces, line by line, what `main` computes in `components/InvoiceBusinessManager` (BC:200-490) and
// `components/InvoiceDriverManager` (DC:120-400). The expressions keep the order of `main`'s operations on purpose: a
// different grouping can move a float by one ulp and an invoice is money. Known defects of `main` that D8 kept
// (D3, D6, D7, D12, D13, D16, D20, D23) are still kept here, each marked where it lives.
//
// (owner decision D-71) fixed D1, D2, D10, D11 and D22 on purpose: they change amounts, so their tests are
// hand computed instead of compared with `main`. D6 and D7 (which statuses are billable) and D12 (who pays a platform
// discount) wait for the team.
//
// The other differences from `main` are the ones D8 allows:
//   D4  every number of the form goes through `toAmount` first (an empty field is 0, not NaN), and the percentages the
//       PDF prints come out already converted (so «Percentage Fee ()%» is «(0%)» and a driver misc of '0' is not printed);
//   D14 `escapeNotes` escapes the HTML of the notes before the line breaks become `<br>`;
//   D8  the name of the business or driver comes from the argument, not from a list.

/** A number of the form as a number: '', null, undefined or anything not numeric is 0 (D4: `main` made NaN of it). */
export const toAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** The notes as safe HTML (D14): `& < > " '` escaped first, then every `\n` becomes `<br>` (as `main` did). */
export const escapeNotes = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/\n/g, '<br>')

/** The ids of the checked items, in the order of the list, only when some but not all are checked (auditor 1);
 *  with all or none checked no filter goes to the server (`[]`), as `main` did without a Save. */
export const serverFilterIds = (items, key = 'id') => {
  const list = Array.isArray(items) ? items : []
  const checked = list.filter(item => item?.checked)
  if (checked.length > 0 && checked.length < list.length) return checked.map(item => item[key])
  return []
}

/** BC:441-445 / DC:358-362. `decimals` is `configs.format_number_decimal_length.value` (a number or a numeric text). */
export const roundPrice = (value, decimals) => {
  const power = Math.pow(10, decimals)
  const poweredVal = Math.round(value * power)
  return poweredVal / power
}

/** BC:354-364 / DC:272-282 */
const suboptionTotal = (option, suboption) => {
  let suboptionQuantity = 1
  let suboptionPrice = suboption.price
  if (option.allow_suboptionQuantity && suboption.quantity) {
    suboptionQuantity = suboption.quantity
  }
  if (option.with_half_option && suboption.position && suboption.position !== 'whole') {
    suboptionPrice = suboption.half_price
  }
  return suboptionPrice * suboptionQuantity
}

/** BC:369-383 / DC:287-301 */
const productTotal = (product) => {
  let total = 0
  if (product.options) {
    for (let i = 0; i < product.options.length; i++) {
      const option = product.options[i]
      if (option.suboptions) {
        for (let j = 0; j < option.suboptions.length; j++) {
          const suboption = option.suboptions[j]
          total += suboptionTotal(option, suboption)
        }
      }
    }
  }
  return (total + product.price) * product.quantity
}

/** BC:388-397 / DC:306-315 */
export const orderIncludedTaxes = (order) => {
  if (!order?.taxes) return 0
  if (order?.taxes?.length === 0) {
    return order.tax_type === 1 ? order?.summary?.tax ?? 0 : 0
  } else {
    return order?.taxes.reduce((taxIncluded, tax) => {
      return taxIncluded + ((tax.type === 1 && tax.target === 'product') ? tax.summary?.tax : 0)
    }, 0)
  }
}

/** BC:402-413 / DC:320-330 */
export const orderSubtotal = (order, decimals) => {
  if (!order.summary) {
    let subtotal = 0
    for (let i = 0; i < order.products.length; i++) {
      subtotal += productTotal(order.products[i])
    }
    return roundPrice(subtotal, decimals)
  } else {
    // Match OrderBill calculation: subtotal + included taxes
    return order.summary.subtotal + orderIncludedTaxes(order)
  }
}

/** BC:418-425 / DC:335-342 */
export const orderTax = (order, decimals) => {
  if (!order.summary) {
    const tax = (order.tax_type === 2) ? order.tax * (orderSubtotal(order, decimals) - order.discount) / 100 : 0
    return roundPrice(tax, decimals)
  } else {
    return order.summary.tax
  }
}

/** BC:430-436 / DC:347-353 */
export const orderDiscount = (order, decimals) => {
  if (!order.summary) {
    return roundPrice(order.discount, decimals)
  } else {
    return order.summary.discount
  }
}

/** BC:465-472 / DC:382-389 */
export const orderServiceFee = (order, decimals) => {
  if (!order.summary) {
    const subtotal = (orderSubtotal(order, decimals) - order.discount) * order.service_fee / 100
    return roundPrice(subtotal, decimals)
  } else {
    return order.summary.service_fee
  }
}

/** BC:477-484 / DC:394-401 */
export const orderDriverTip = (order, decimals) => {
  if (!order.summary) {
    const tip = (orderSubtotal(order, decimals) - order.discount) * order.driver_tip / 100
    return roundPrice(tip, decimals)
  } else {
    return order.summary.driver_tip
  }
}

/** BC:450-460 / DC:367-377 */
export const orderTotal = (order, decimals) => {
  if (!order.summary) {
    const subtotal = orderSubtotal(order, decimals)
    const tax = orderTax(order, decimals)
    const serviceFee = orderServiceFee(order, decimals)
    // D10 fixed: `main` compared `delivery_type` with the string '2' while the API sends numbers, so a pickup
    // without `summary` got the delivery price and the tip added.
    const totalorder = Number(order.delivery_type) === 2 ? subtotal + tax + serviceFee - order.discount : subtotal + tax + order.delivery_zone_price + orderDriverTip(order, decimals) + serviceFee - order.discount
    return roundPrice(totalorder, decimals)
  } else {
    return order.summary.total
  }
}

/** The `where` of the orders request of a business invoice, in the order `main` builds it (BC:205-244).
 *  `deliveryTypeIds` and `paymethodIds` are added only when not empty. */
export const businessOrdersWhere = ({ businessId, from, to, deliveryTypeIds, paymethodIds }) => {
  const where = [
    {
      attribute: 'business_id',
      value: businessId
    }
  ]
  if (from) {
    where.push({
      attribute: 'delivery_datetime',
      value: {
        condition: '>=',
        value: `${from} 00:00:00`
      }
    })
  }
  if (to) {
    where.push({
      attribute: 'delivery_datetime',
      value: {
        condition: '<=',
        value: `${to} 23:59:59`
      }
    })
  }
  if (deliveryTypeIds?.length) {
    where.push({
      attribute: 'delivery_type',
      value: deliveryTypeIds
    })
  }
  if (paymethodIds?.length) {
    where.push({
      attribute: 'paymethod_id',
      value: paymethodIds
    })
  }
  return where
}

/** The `where` of the orders request of a driver invoice, in the order `main` builds it (DC:134-165). */
export const driverOrdersWhere = ({ driverId, from, to, paymethodIds }) => {
  const where = [
    {
      attribute: 'driver_id',
      value: driverId
    }
  ]
  if (from) {
    where.push({
      attribute: 'delivery_datetime',
      value: {
        condition: '>=',
        value: `${from} 00:00:00`
      }
    })
  }
  if (to) {
    where.push({
      attribute: 'delivery_datetime',
      value: {
        condition: '<=',
        value: `${to} 23:59:59`
      }
    })
  }
  if (paymethodIds?.length) {
    where.push({
      attribute: 'paymethod_id',
      value: paymethodIds
    })
  }
  return where
}

const checkedValues = (items, key) => (Array.isArray(items) ? items : []).filter(item => item?.checked).map(item => item[key])

const WALLET_CURRENCIES = ['cash_wallet', 'credit_points']

/** An order with a payment event of a wallet (cash wallet or points): it passes the payment method filter, as `main` meant. */
const paidWithWallet = (order) => (order.payment_events || []).some(event => (
  event?.wallet_event?.wallet_id != null || WALLET_CURRENCIES.includes(event?.data?.wallet_currency)
))

/** The day of a `YYYY-MM-DD` text as a local date at 00:00, or null when it is not a day (BC:281-286). */
const dayLimit = (text, hours, minutes, seconds, milliseconds) => {
  const parts = String(text ?? '').split('-')
  if (parts.length === 1) return null
  return new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, seconds, milliseconds)
}

/** The day of the `delivery_datetime` of an order as a local date at 00:00 (BC:289-290). */
const orderDay = (order) => {
  const date = order.delivery_datetime.split(' ')
  return new Date(date[0].split('-')[0], date[0].split('-')[1] - 1, date[0].split('-')[2], 0, 0, 0, 0)
}

/**
 * The orders a business invoice counts (BC:287-301), with the checked payment methods and order types.
 * D1 fixed: in `main` any order with a `payment_event` passed the payment method filter (`walletIds` had one
 * entry per event, maybe `undefined`, so its length was never 0); now only a checked method or a wallet payment passes.
 * D22 fixed: with no order type to choose from (no `order_types_allowed`), the type does not filter; `main`
 * dropped every order.
 * D6 and D7 kept: «Include canceled orders» lets every status pass, and the billable statuses are the ones of `main`.
 */
export const filterBusinessOrders = ({ orders, form, payMethods, orderTypes }) => {
  const paymethods = checkedValues(payMethods, 'id')
  const filterTypes = Array.isArray(orderTypes) && orderTypes.length > 0
  const _orderTypes = filterTypes ? checkedValues(orderTypes, 'value') : []
  const from = dayLimit(form.from, 0, 0, 0, 0)
  const to = dayLimit(form.to, 0, 0, 0, 0)
  return orders.filter((order) => {
    let valid = true
    const date = orderDay(order)
    const orderPaymethodIds = order.payment_events.reduce((ids, event) => [...ids, event?.paymethod?.id], [])
    orderPaymethodIds.push(order.paymethod_id)
    if ((!orderPaymethodIds.some(id => paymethods.includes(id)) && !paidWithWallet(order)) ||
      (filterTypes && _orderTypes.indexOf(order.delivery_type) === -1) ||
      ([0, 1, 7, 8, 9, 11, 15].indexOf(order.status) === -1 && !form.cancelled)) {
      valid = false
    }
    if ((from && from > date) || (to && to < date)) valid = false
    return valid
  })
}

/**
 * The orders a driver invoice counts (DC:194-222).
 * D2 fixed: in `main`, with a wallet enabled the status, payment method and «cancelled» filters did not run
 * at all (the wallet branch read `payment_events.data` on an array and `valid = true` changed nothing). Now they always
 * run, and with a wallet enabled an order paid with the wallet passes the payment method filter.
 * D3 kept: `to` is built at 11:59:59.059 (a typo of 23:59:59.999) and has no effect because the order day is cut to 00:00.
 */
export const filterDriverOrders = ({ orders, form, payMethods, walletEnabled }) => {
  const paymethods = checkedValues(payMethods, 'id')
  const from = dayLimit(form.from, 0, 0, 0, 0)
  const to = dayLimit(form.to, 11, 59, 59, 59)
  return orders.filter((order) => {
    let valid = true
    const date = orderDay(order)
    const orderPaymethodIds = order.payment_events.reduce((ids, event) => [...ids, event?.paymethod?.id], [])
    orderPaymethodIds.push(order.paymethod_id)
    if ((!orderPaymethodIds.some(id => paymethods.includes(id)) && !(walletEnabled && paidWithWallet(order))) ||
      [1, 2, 5, 6, 10, 11, 12].indexOf(order.status) === -1 ||
      ([2, 5, 6, 10, 12].indexOf(order.status) > -1 && !form.cancelled)) {
      valid = false
    }
    if ((from && from > date) || (to && to < date)) valid = false
    return valid
  })
}

/**
 * The invoice of a business: `getExportInvoice` of `BC` (BC:270-349).
 * `payMethods` and `orderTypes` are the lists of the controller contract (`checked`); `business` is `{ id, name }` or null.
 * D12 kept: in a charge with discounts the discount lowers the base of the commission and is also subtracted in full. Which
 * of the two is wrong depends on who pays a «discount by platform», a question for the team.
 */
export const buildBusinessInvoice = ({ orders: result, form, payMethods, orderTypes, business, decimals }) => {
  const type = form.type
  const sign = type !== 'payout' ? 1 : -1
  const percentageFee = toAmount(form.percentage_fee)
  const fixedFee = toAmount(form.fixed_fee)
  const tax = toAmount(form.tax)
  const miscAmount = toAmount(form.misc_amount)
  const subtotalOf = (order) => orderSubtotal(order, decimals)
  const totalOf = (order) => orderTotal(order, decimals)
  const orders = filterBusinessOrders({ orders: result, form, payMethods, orderTypes })
  const _exportInvoice = {
    from: form.from,
    to: form.to,
    type,
    orders,
    percentage_fee: percentageFee,
    fixed_fee: fixedFee,
    tax,
    misc_amount: sign * miscAmount,
    misc_description: form.misc_description,
    inlcude_discounts: form.discounts,
    tax_products: type !== 'payout'
      ? 0
      : orders?.reduce(function (previous, current) {
        if (current.tax_type === 1) return previous
        else return previous + orderTax(current, decimals)
      }, 0),
    discounts: !form.discounts
      ? 0
      : orders?.reduce(function (previous, current) {
        return previous - orderDiscount(current, decimals)
      }, 0),
    orders_subtotal: orders?.reduce(function (previous, current) {
      return previous + subtotalOf(current)
    }, 0),
    orders_total: orders?.reduce(function (previous, current) {
      return previous + totalOf(current)
    }, 0),
    notes: escapeNotes(form.notes)
  }
  _exportInvoice.percentage_fee_total = sign * (_exportInvoice.orders_subtotal + _exportInvoice.discounts) * percentageFee / 100
  _exportInvoice.fixed_fee_total = sign * orders.length * fixedFee
  const subtotal = parseFloat(_exportInvoice.percentage_fee_total) +
    parseFloat(_exportInvoice.fixed_fee_total) +
    parseFloat(_exportInvoice.misc_amount) +
    parseFloat(_exportInvoice.discounts) +
    parseFloat(_exportInvoice.tax_products) +
    (type !== 'payout' ? 0 : parseFloat(_exportInvoice.orders_subtotal))
  _exportInvoice.subtotal = subtotal
  _exportInvoice.tax_total = sign * subtotal * parseFloat(tax) / 100
  _exportInvoice.total = subtotal + _exportInvoice.tax_total
  if (business) _exportInvoice.business = business
  return _exportInvoice
}

/**
 * The invoice of a driver: `getExportInvoice` of `DC` (DC:194-267).
 * `walletEnabled` is `wallet_cash_enabled === '1' || wallet_credit_point_enabled === '1'`; `driver` is `{ id, name }` or null.
 * D11 fixed: the delivery price percentage reads `summary.delivery_price` like every other amount, and
 * `delivery_zone_price` only for an order without it (`main` read `delivery_zone_price` always: NaN or 0 when missing).
 * D20 kept: the «Orders» and «Discount» rows are shown by the PDF but do not enter the subtotal (marks them).
 */
export const buildDriverInvoice = ({ orders: result, form, payMethods, driver, decimals, walletEnabled }) => {
  const percentageFee = toAmount(form.percentage_fee)
  const fixedFee = toAmount(form.fixed_fee)
  const percentageDeliveryPrice = toAmount(form.percentage_delivery_price)
  const percentageDriverTip = toAmount(form.percentage_driver_tip)
  const tax = toAmount(form.tax)
  const miscAmount = toAmount(form.misc_amount)
  const orders = filterDriverOrders({ orders: result, form, payMethods, walletEnabled })
  const _exportInvoice = {
    from: form.from,
    to: form.to,
    orders,
    percentage_fee: percentageFee,
    fixed_fee: fixedFee,
    tax,
    misc_amount: miscAmount,
    misc_description: form.misc_description,
    orders_subtotal: orders?.reduce(function (previous, current) {
      return previous + orderSubtotal(current, decimals)
    }, 0),
    orders_total: orders?.reduce(function (previous, current) {
      return previous + orderTotal(current, decimals)
    }, 0),
    discounts: orders?.reduce(function (previous, current) {
      return previous - orderDiscount(current, decimals)
    }, 0),
    percentage_delivery_price: percentageDeliveryPrice,
    percentage_delivery_price_total: orders?.reduce(function (previous, current) {
      return previous + toAmount(current.summary?.delivery_price ?? current.delivery_zone_price)
    }, 0) * percentageDeliveryPrice / 100,
    percentage_driver_tip: percentageDriverTip,
    percentage_driver_tip_total: orders?.reduce(function (previous, current) {
      return previous + orderDriverTip(current, decimals)
    }, 0) * percentageDriverTip / 100,
    notes: escapeNotes(form.notes)
  }
  _exportInvoice.percentage_fee_total = (_exportInvoice.orders_subtotal + _exportInvoice.discounts) * percentageFee / 100
  _exportInvoice.fixed_fee_total = orders.length * fixedFee
  const subtotal = parseFloat(_exportInvoice.percentage_fee_total) +
    parseFloat(_exportInvoice.fixed_fee_total) +
    parseFloat(_exportInvoice.misc_amount) +
    parseFloat(_exportInvoice.percentage_delivery_price_total) +
    parseFloat(_exportInvoice.percentage_driver_tip_total)
  _exportInvoice.subtotal = subtotal
  _exportInvoice.tax_total = subtotal * parseFloat(tax) / 100
  _exportInvoice.total = subtotal + _exportInvoice.tax_total
  if (driver) _exportInvoice.driver = driver
  return _exportInvoice
}
