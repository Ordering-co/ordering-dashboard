// redesign stores 5.9 (G4-06): the pure rules the Payments list follows. Every `it` pins one rule of the model.
import { describe, expect, it } from 'vitest'
import {
  NO_KEY_GATEWAYS,
  GLOBAL_GATEWAYS,
  METHODS_PAY_GATEWAYS,
  FIXED_KEY_GATEWAYS,
  CREDIT_CARD_GATEWAYS,
  BRAINTREE_GATEWAYS,
  hasTemplate,
  isTemplated,
  getGatewayKind,
  needsCredentials,
  isGlobalKeysMissing,
  isDataMissing,
  hasMissingCredentials,
  getMissingSandboxFields,
  humanizeFieldKey,
  getToggleDecision,
  getSelectAllPlan,
  normalizeIds,
  isSecretField
} from '../paymethodModel'

const FULL_CONFIGS = {
  stripe_publishable: { value: 'pk' },
  stripe_publishable_sandbox: { value: 'pk_t' },
  stripe_secret: { value: 'sk' },
  stripe_secret_sandbox: { value: 'sk_t' },
  global_apple_pay_publishable: { value: 'a' },
  global_apple_pay_publishable_sandbox: { value: 'a' },
  global_apple_pay_secret: { value: 'a' },
  global_apple_pay_secret_sandbox: { value: 'a' },
  global_google_pay_publishable: { value: 'g' },
  global_google_pay_publishable_sandbox: { value: 'g' },
  global_google_pay_secret: { value: 'g' },
  global_google_pay_secret_sandbox: { value: 'g' },
  computop_merchant_id: { value: 'm' },
  computop_blowfish_password: { value: 'b' },
  computop_hmac_password: { value: 'h' }
}

const CASH = { id: 1, gateway: 'cash', data_template: null }
const PAGAZUL = { id: 2, gateway: 'pagazul', data_template: [{ key: 'api_key', required: true }, { key: 'note' }] }
const BRAINTREE = { id: 3, gateway: 'braintree', data_template: [] }
const CONNECT_LINK = { id: 4, gateway: 'stripe_connect_link', data_template: null }
const PAYPAL = { id: 5, gateway: 'paypal', data_template: null }
const STRIPE = { id: 6, gateway: 'stripe', data_template: null }

describe('paymethodModel · lists', () => {
  it('exports the gateway lists', () => {
    // main, Stripe Connect v2 brings no keys
    expect(NO_KEY_GATEWAYS).toEqual(['cash', 'card_delivery', 'izipay', 'physical_terminal', 'stripe_terminal', 'hyp', 'giftme', 'stripe_connect_v2'])
    expect(GLOBAL_GATEWAYS).toEqual(['global_google_pay', 'global_apple_pay', 'stripe', 'computop'])
    expect(METHODS_PAY_GATEWAYS).toEqual(['google_pay', 'apple_pay'])
    expect(FIXED_KEY_GATEWAYS).toContain('stripe_connect')
    expect(FIXED_KEY_GATEWAYS).toHaveLength(11)
    expect(CREDIT_CARD_GATEWAYS).toEqual(['google_pay', 'apple_pay', 'stripe', 'stripe_checkout', 'paypal', 'stripe_link'])
    expect(BRAINTREE_GATEWAYS).toEqual(['braintree', 'google_pay_braintree', 'apple_pay_braintree', 'paypal_braintree'])
  })
})

describe('paymethodModel · templates', () => {
  it('hasTemplate is false for null and undefined', () => {
    expect(hasTemplate({ data_template: null })).toBe(false)
    expect(hasTemplate({})).toBe(false)
    expect(hasTemplate({ data_template: [] })).toBe(true)
  })

  it('isTemplated keeps today\'s rule: only null is not templated', () => {
    expect(isTemplated({ data_template: null })).toBe(false)
    expect(isTemplated({})).toBe(true)
    expect(isTemplated({ data_template: [] })).toBe(true)
    expect(isTemplated(undefined)).toBe(true)
  })
})

describe('paymethodModel · getGatewayKind / needsCredentials', () => {
  it('global gateways are global and need credentials', () => {
    expect(getGatewayKind(STRIPE)).toBe('global')
    expect(getGatewayKind({ gateway: 'computop', data_template: null })).toBe('global')
    expect(needsCredentials(STRIPE)).toBe(true)
  })

  it('fixed-key gateways are fixed and need credentials', () => {
    expect(getGatewayKind(PAYPAL)).toBe('fixed')
    expect(getGatewayKind({ gateway: 'google_pay', data_template: [] })).toBe('fixed')
    expect(needsCredentials(PAYPAL)).toBe(true)
  })

  it('no-key gateways are none', () => {
    expect(getGatewayKind(CASH)).toBe('none')
    expect(getGatewayKind({ gateway: 'izipay', data_template: [{ key: 'x', required: true }] })).toBe('none')
    expect(needsCredentials(CASH)).toBe(false)
  })

  // redesign bugs C: main (`isDataTemplateRequired` = `!data_template`) asked a generic gateway for data its form has no
  // field for, so it could never be turned on. It has no keys: it turns on like cash.
  it('stripe_connect_link (null template, in no list) is generic and, with no field to fill, needs no credentials', () => {
    expect(getGatewayKind(CONNECT_LINK)).toBe('generic')
    expect(needsCredentials(CONNECT_LINK)).toBe(false)
    expect(hasMissingCredentials(CONNECT_LINK, { id: 9, paymethod_id: 4, enabled: false, data: null }, {})).toBe(false)
  })

  it('a generic gateway with a record and no data turns on at once', () => {
    expect(getToggleDecision({ paymethod: CONNECT_LINK, businessPaymethod: { id: 9, paymethod_id: 4, enabled: false, data: null }, next: true, enabledCount: 3, isAdmin: true, configs: {} }))
      .toEqual({ type: 'toggle' })
  })

  it('braintree with an empty template is template but needs no credentials', () => {
    expect(getGatewayKind(BRAINTREE)).toBe('template')
    expect(needsCredentials(BRAINTREE)).toBe(false)
  })

  it('pagazul with a required field needs credentials', () => {
    expect(getGatewayKind(PAGAZUL)).toBe('template')
    expect(needsCredentials(PAGAZUL)).toBe(true)
  })
})

describe('paymethodModel · missing keys and data', () => {
  it('isGlobalKeysMissing follows the global configs rules per gateway', () => {
    expect(isGlobalKeysMissing('stripe', FULL_CONFIGS)).toBe(false)
    expect(isGlobalKeysMissing('stripe', { ...FULL_CONFIGS, stripe_secret_sandbox: { value: '' } })).toBe(true)
    expect(isGlobalKeysMissing('global_apple_pay', { ...FULL_CONFIGS, global_apple_pay_secret: { value: '' } })).toBe(true)
    expect(isGlobalKeysMissing('global_google_pay', FULL_CONFIGS)).toBe(false)
    expect(isGlobalKeysMissing('computop', { ...FULL_CONFIGS, computop_hmac_password: undefined })).toBe(true)
    expect(isGlobalKeysMissing('computop', undefined)).toBe(true)
  })

  it('isGlobalKeysMissing is false for a non-global gateway', () => {
    expect(isGlobalKeysMissing('cash', {})).toBe(false)
    expect(isGlobalKeysMissing('paypal', undefined)).toBe(false)
  })

  it('isDataMissing: no data, a null or an empty value', () => {
    expect(isDataMissing(undefined)).toBe(true)
    expect(isDataMissing({})).toBe(true)
    expect(isDataMissing({ data: { a: 'x', b: null } })).toBe(true)
    expect(isDataMissing({ data: { a: 'x', b: '' } })).toBe(true)
    expect(isDataMissing({ data: { a: 'x', b: 'y' } })).toBe(false)
  })

  it('hasMissingCredentials: false when no credentials are needed', () => {
    expect(hasMissingCredentials(CASH, undefined, {})).toBe(false)
    expect(hasMissingCredentials(BRAINTREE, undefined, {})).toBe(false)
  })

  it('hasMissingCredentials: global looks at the global keys, others at the record data', () => {
    expect(hasMissingCredentials(STRIPE, undefined, FULL_CONFIGS)).toBe(false)
    expect(hasMissingCredentials(STRIPE, undefined, {})).toBe(true)
    expect(hasMissingCredentials(PAYPAL, undefined, {})).toBe(true)
    expect(hasMissingCredentials(PAYPAL, { data: { a: 'x' } }, {})).toBe(false)
    expect(hasMissingCredentials(PAGAZUL, { data: { api_key: '' } }, {})).toBe(true)
  })
})

describe('paymethodModel · getToggleDecision', () => {
  const base = { enabledCount: 3, isAdmin: false, configs: FULL_CONFIGS }

  it('blocks turning off the last enabled one (min)', () => {
    expect(getToggleDecision({ ...base, paymethod: CASH, businessPaymethod: { enabled: true }, next: false, enabledCount: 1 }))
      .toEqual({ type: 'block', reason: 'min' })
  })

  it('blocks a global gateway with missing keys for a non-admin, in both directions', () => {
    const configs = {}
    expect(getToggleDecision({ ...base, configs, paymethod: STRIPE, businessPaymethod: undefined, next: true }))
      .toEqual({ type: 'block', reason: 'contact' })
    expect(getToggleDecision({ ...base, configs, paymethod: STRIPE, businessPaymethod: { enabled: false }, next: true }))
      .toEqual({ type: 'block', reason: 'contact' })
    expect(getToggleDecision({ ...base, configs, paymethod: STRIPE, businessPaymethod: { enabled: true }, next: false }))
      .toEqual({ type: 'block', reason: 'contact' })
  })

  it('lets an admin through a global gateway with missing keys', () => {
    expect(getToggleDecision({ ...base, configs: {}, isAdmin: true, paymethod: STRIPE, businessPaymethod: undefined, next: true }))
      .toEqual({ type: 'create-open' })
  })

  it('asks first before turning off an enabled one (confirm-off)', () => {
    expect(getToggleDecision({ ...base, paymethod: CASH, businessPaymethod: { enabled: true }, next: false }))
      .toEqual({ type: 'confirm-off' })
  })

  it('turning off a record that is already off is a plain toggle', () => {
    expect(getToggleDecision({ ...base, paymethod: CASH, businessPaymethod: { enabled: false }, next: false }))
      .toEqual({ type: 'toggle' })
  })

  it('opens the editor for data when a record exists with missing credentials', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: false, data: null }, next: true }))
      .toEqual({ type: 'open', reason: 'data' })
  })

  it('never opens for data a templated gateway with no required field', () => {
    expect(getToggleDecision({ ...base, paymethod: BRAINTREE, businessPaymethod: { enabled: false, data: null }, next: true }))
      .toEqual({ type: 'toggle' })
  })

  it('toggles a record that has its credentials', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: false, data: { a: 'x' } }, next: true }))
      .toEqual({ type: 'toggle' })
  })

  it('creates a disabled record and opens the editor when credentials are needed (create-open)', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: undefined, next: true }))
      .toEqual({ type: 'create-open' })
    expect(getToggleDecision({ ...base, paymethod: PAGAZUL, businessPaymethod: undefined, next: true }))
      .toEqual({ type: 'create-open' })
  })

  it('creates it enabled when no credentials are needed (S-6)', () => {
    expect(getToggleDecision({ ...base, paymethod: CASH, businessPaymethod: undefined, next: true })).toEqual({ type: 'create' })
    expect(getToggleDecision({ ...base, paymethod: BRAINTREE, businessPaymethod: undefined, next: true })).toEqual({ type: 'create' })
    expect(getToggleDecision({ ...base, paymethod: CONNECT_LINK, businessPaymethod: undefined, next: true })).toEqual({ type: 'create' })
  })
})

describe('paymethodModel · getSelectAllPlan', () => {
  const rows = [
    CASH,
    PAGAZUL,
    { id: 10, gateway: 'paypal', installState: 'available' },
    { gateway: 'no_id' },
    STRIPE
  ]
  const businessPaymethods = [{ id: 91, paymethod_id: 1, enabled: true }]

  it('skips an enabled row and a catalog row (installState or no id)', () => {
    const plan = getSelectAllPlan({ paymethods: rows, businessPaymethods, isAdmin: true, configs: FULL_CONFIGS })
    expect(plan.targets).toEqual([2, 6])
  })

  it('skips a global row with missing keys for a non-admin but keeps it for an admin', () => {
    const nonAdmin = getSelectAllPlan({ paymethods: rows, businessPaymethods, isAdmin: false, configs: {} })
    expect(nonAdmin.targets).toEqual([2])
    const admin = getSelectAllPlan({ paymethods: rows, businessPaymethods, isAdmin: true, configs: {} })
    expect(admin.targets).toEqual([2, 6])
  })

  it('counts how many targets lack credentials', () => {
    const plan = getSelectAllPlan({ paymethods: rows, businessPaymethods, isAdmin: true, configs: FULL_CONFIGS })
    expect(plan.missingCredentials).toBe(1)
    const withData = getSelectAllPlan({
      paymethods: rows,
      businessPaymethods: [...businessPaymethods, { id: 92, paymethod_id: 2, enabled: false, data: { api_key: 'k' } }],
      isAdmin: true,
      configs: FULL_CONFIGS
    })
    expect(withData.targets).toEqual([2, 6])
    expect(withData.missingCredentials).toBe(0)
  })

  it('works with nothing to do', () => {
    expect(getSelectAllPlan({ paymethods: [], businessPaymethods: [], isAdmin: false, configs: {} })).toEqual({ targets: [], missingCredentials: 0 })
  })
})

describe('paymethodModel · normalizeIds / isSecretField', () => {
  it('normalizeIds accepts objects and plain ids and drops empties', () => {
    expect(normalizeIds([{ id: 1 }, 2, null, undefined, { id: 3, name: 'x' }])).toEqual([1, 2, 3])
    expect(normalizeIds(undefined)).toEqual([])
  })

  it('isSecretField detects password type and secret-looking keys', () => {
    expect(isSecretField({ type: 'password', key: 'x' })).toBe(true)
    expect(isSecretField({ type: 'text', key: 'client_secret' })).toBe(true)
    expect(isSecretField({ type: 'text', key: 'hmac_key' })).toBe(true)
    expect(isSecretField({ type: 'text', key: 'merchant_id' })).toBe(false)
    expect(isSecretField({ type: 'text' })).toBe(false)
  })
})

// owner decision 5 C (W1): the on-switch check still reads Live only (it blocks as on main); a gateway in Sandbox mode
// with complete Live data and a gap in `data_sandbox` still turns on, and the list warns about the Sandbox fields.
describe('paymethodModel · Sandbox data gap (decision 5 C)', () => {
  const base = { enabledCount: 3, isAdmin: false, configs: FULL_CONFIGS }
  const LIVE = { client_id: 'live-id', secret: 'live-secret' }

  it('humanizeFieldKey makes a readable label of a key', () => {
    expect(humanizeFieldKey('client_id')).toBe('Client ID')
    expect(humanizeFieldKey('private_sandbox_key')).toBe('Private Sandbox Key')
    expect(humanizeFieldKey('secret')).toBe('Secret')
  })

  it('getMissingSandboxFields names the empty Sandbox values of a record in Sandbox mode with its Live data complete', () => {
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: { client_id: 'x', secret: '' } })).toEqual(['secret'])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: { client_id: null, secret: null } })).toEqual(['client_id', 'secret'])
  })

  it('getMissingSandboxFields reads data_sandbox sent as a JSON string, and survives a broken one', () => {
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: JSON.stringify({ client_id: 'x', secret: '' }) })).toEqual(['secret'])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: '{not json' })).toEqual(['client_id', 'secret'])
  })

  // W1 review F5: a partial data_sandbox still names the Live keys it lacks; a Live `data` sent as a string is read as keys, not characters
  it('getMissingSandboxFields checks the Live keys and the Sandbox keys together', () => {
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: { client_id: 'x' } })).toEqual(['secret'])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: { client_id: 'x', secret: 'y', extra: '' } })).toEqual(['extra'])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: JSON.stringify(LIVE), data_sandbox: { client_id: 'x' } })).toEqual(['secret'])
  })

  it('getMissingSandboxFields falls back to the Live keys when data_sandbox is empty or absent', () => {
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: null })).toEqual(['client_id', 'secret'])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: {} })).toEqual(['client_id', 'secret'])
  })

  it('getMissingSandboxFields is empty in Live mode, with Live data missing, with Sandbox complete or when the gateway has no Sandbox keys of its own', () => {
    expect(getMissingSandboxFields(PAYPAL, { sandbox: false, data: LIVE, data_sandbox: {} })).toEqual([])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: { client_id: '', secret: 'x' }, data_sandbox: {} })).toEqual([])
    expect(getMissingSandboxFields(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: { client_id: 'a', secret: 'b' } })).toEqual([])
    expect(getMissingSandboxFields(PAYPAL, undefined)).toEqual([])
    expect(getMissingSandboxFields(CASH, { sandbox: true, data: null, data_sandbox: null })).toEqual([])
    expect(getMissingSandboxFields(STRIPE, { sandbox: true, data: LIVE, data_sandbox: {} })).toEqual([])
    expect(getMissingSandboxFields({ id: 9, gateway: 'stripe_connect', data_template: null }, { sandbox: true, data: LIVE, data_sandbox: {} })).toEqual([])
  })

  it('turns on, with the Sandbox fields to warn about, when Live is complete and Sandbox has a gap', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: false, sandbox: true, data: LIVE, data_sandbox: { client_id: 'x', secret: '' } }, next: true }))
      .toEqual({ type: 'toggle', warnSandbox: ['secret'] })
  })

  it('still opens for data when Live is missing, even in Sandbox mode with Sandbox complete', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: false, sandbox: true, data: { client_id: '', secret: 'x' }, data_sandbox: { client_id: 'a', secret: 'b' } }, next: true }))
      .toEqual({ type: 'open', reason: 'data' })
  })

  it('does not warn in Live mode with an empty Sandbox, nor when turning off', () => {
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: false, sandbox: false, data: LIVE, data_sandbox: {} }, next: true }))
      .toEqual({ type: 'toggle' })
    expect(getToggleDecision({ ...base, paymethod: PAYPAL, businessPaymethod: { enabled: true, sandbox: true, data: LIVE, data_sandbox: {} }, next: false }))
      .toEqual({ type: 'confirm-off' })
  })

  it('hasMissingCredentials stays Live only', () => {
    expect(hasMissingCredentials(PAYPAL, { sandbox: true, data: LIVE, data_sandbox: {} }, {})).toBe(false)
  })
})
