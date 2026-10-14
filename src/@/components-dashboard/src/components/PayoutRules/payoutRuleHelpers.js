/**
 * Payout rules of Stripe Connect: what the platform keeps of an
 * order (`platform`) and what its driver earns (`driver`).
 * The API takes a rule whole on every save, so a form always carries every
 * field of its scope.
 */

export const PAYOUT_RULE_FIELDS = {
  platform: ['fixed', 'percentage', 'percentage_base'],
  driver: [
    'order_type',
    'order_fixed',
    'order_percentage',
    'order_base',
    'delivery_fee_percentage',
    'tip_percentage',
    'additional_fixed',
    'additional_percentage',
    'additional_base'
  ]
}

/** What a scope starts from while no rule is saved. */
export const PAYOUT_RULE_DEFAULTS = {
  platform: { fixed: '0', percentage: '0', percentage_base: 'subtotal' },
  driver: {
    order_type: 'fixed',
    order_fixed: '0',
    order_percentage: '0',
    order_base: 'subtotal',
    delivery_fee_percentage: '100',
    tip_percentage: '100',
    additional_fixed: '0',
    additional_percentage: '0',
    additional_base: 'subtotal'
  }
}

const AMOUNT_FIELDS = ['fixed', 'order_fixed', 'additional_fixed']
const OPTION_FIELDS = {
  percentage_base: ['subtotal', 'total'],
  order_type: ['fixed', 'percentage'],
  order_base: ['subtotal', 'total'],
  additional_base: ['subtotal', 'total']
}

const MAX_AMOUNT = 1000000
const MAX_PERCENTAGE = 100
// The API refuses more than two decimals instead of rounding them
const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/

export const getPayoutRuleFieldKind = (field) => {
  if (OPTION_FIELDS[field]) return 'option'
  return AMOUNT_FIELDS.includes(field) ? 'amount' : 'percentage'
}

/**
 * A saved rule as the form holds it: every field of the scope as a string,
 * with the default of the ones the rule does not carry.
 */
export const toPayoutRuleForm = (scope, rule) => {
  const defaults = PAYOUT_RULE_DEFAULTS[scope] || {}
  return (PAYOUT_RULE_FIELDS[scope] || []).reduce((values, field) => {
    const value = rule?.[field]
    values[field] = value === null || value === undefined || value === '' ? defaults[field] : String(value)
    return values
  }, {})
}

/**
 * The fields of a form the API would refuse, as `{ field: 'amount' | 'percentage' | 'option' }`.
 * Empty when the rule can be saved.
 */
export const validatePayoutRuleForm = (scope, values = {}) => {
  return (PAYOUT_RULE_FIELDS[scope] || []).reduce((errors, field) => {
    const kind = getPayoutRuleFieldKind(field)
    const value = String(values[field] ?? '').trim()
    if (kind === 'option') {
      if (!OPTION_FIELDS[field].includes(value)) errors[field] = kind
      return errors
    }
    const max = kind === 'amount' ? MAX_AMOUNT : MAX_PERCENTAGE
    if (!TWO_DECIMALS.test(value) || Number(value) > max) errors[field] = kind
    return errors
  }, {})
}

/** A valid form as the API takes it: amounts and percentages as numbers. */
export const toPayoutRulePayload = (scope, values = {}) => {
  return (PAYOUT_RULE_FIELDS[scope] || []).reduce((payload, field) => {
    const value = String(values[field] ?? '').trim()
    payload[field] = getPayoutRuleFieldKind(field) === 'option' ? value : Number(value)
    return payload
  }, {})
}

/** Whether a form says the same as a saved rule (`1` and `1.00` are the same amount). */
export const isSamePayoutRule = (scope, values, rule) => {
  if (!rule) return false
  const saved = toPayoutRuleForm(scope, rule)
  return (PAYOUT_RULE_FIELDS[scope] || []).every(field => {
    const value = String(values?.[field] ?? '').trim()
    if (getPayoutRuleFieldKind(field) === 'option') return value === saved[field]
    return value !== '' && Number(value) === Number(saved[field])
  })
}

/** The order the forms show an example of, in cents. Only an illustration: the API computes each real order. */
export const PAYOUT_RULE_EXAMPLE_ORDER = { subtotal: 2000, delivery_fee: 300, tip: 200, total: 2500 }

const readNumber = (values, field) => {
  const value = String(values?.[field] ?? '').trim()
  const max = getPayoutRuleFieldKind(field) === 'amount' ? MAX_AMOUNT : MAX_PERCENTAGE
  return TWO_DECIMALS.test(value) && Number(value) <= max ? Number(value) : null
}

// To the nearest cent, half a cent up: what the API's calculator does
const percentageOf = (percentage, cents) => percentage === null ? null : Math.round(cents * percentage / 100)
const toCents = (amount) => amount === null ? null : Math.round(amount * 100)

/**
 * What a form would pay out of the example order, part by part and in cents.
 * A part is null while its value cannot be read, and then so is the total.
 */
export const getPayoutRuleExample = (scope, values = {}) => {
  const order = PAYOUT_RULE_EXAMPLE_ORDER
  const parts = scope === 'platform'
    ? {
        fixed: toCents(readNumber(values, 'fixed')),
        percentage: percentageOf(readNumber(values, 'percentage'), order[values.percentage_base])
      }
    : {
        order: values.order_type === 'percentage'
          ? percentageOf(readNumber(values, 'order_percentage'), order[values.order_base])
          : toCents(readNumber(values, 'order_fixed')),
        delivery_fee: percentageOf(readNumber(values, 'delivery_fee_percentage'), order.delivery_fee),
        tip: percentageOf(readNumber(values, 'tip_percentage'), order.tip),
        extra_fixed: toCents(readNumber(values, 'additional_fixed')),
        extra_percentage: percentageOf(readNumber(values, 'additional_percentage'), order[values.additional_base])
      }
  const amounts = Object.values(parts)
  const readable = amounts.every(amount => typeof amount === 'number' && !Number.isNaN(amount))
  return {
    parts,
    total: readable ? amounts.reduce((sum, amount) => sum + amount, 0) : null
  }
}
