// redesign stores 5.9 (G4-06): the rules of the Payments list as pure functions (no React, no hooks), so the
// list, the editor and the tests read the same truth. Parity with the legacy screen is deliberate: where today's UI
// has a quirk (`data_template !== null`), `isTemplated` keeps it and every rule below uses it.

// gateways that have no keys to fill: turning them on never opens an editor
// main, Stripe Connect v2 brings no keys (the store gets paid on its Stripe account)
export const NO_KEY_GATEWAYS = ['cash', 'card_delivery', 'izipay', 'physical_terminal', 'stripe_terminal', 'hyp', 'giftme', 'stripe_connect_v2']
// gateways whose keys live in the project's global configs (the business only turns them on)
export const GLOBAL_GATEWAYS = ['global_google_pay', 'global_apple_pay', 'stripe', 'computop']
export const METHODS_PAY_GATEWAYS = ['google_pay', 'apple_pay']
// gateways with a fixed form of their own keys (5.10a/5.10b/5.11 forms + Apple/Google Pay)
export const FIXED_KEY_GATEWAYS = ['paypal', 'paypal_express', 'stripe_checkout', 'stripe_link', 'square', 'credomatic', 'checkout_pro_mercadopago', 'epayco', 'google_pay', 'apple_pay', 'stripe_connect']
export const CREDIT_CARD_GATEWAYS = ['google_pay', 'apple_pay', 'stripe', 'stripe_checkout', 'paypal', 'stripe_link']
export const BRAINTREE_GATEWAYS = ['braintree', 'google_pay_braintree', 'apple_pay_braintree', 'paypal_braintree']

export const hasTemplate = (paymethod) => paymethod?.data_template !== null && paymethod?.data_template !== undefined

// today's UI rule, as is: only an explicit `null` means «no template» (an `undefined` counts as templated)
export const isTemplated = (paymethod) => paymethod?.data_template !== null

/**
 * 'global' | 'fixed' | 'template' | 'generic' | 'none'
 * A gateway with a null template that is not in any list (e.g. `stripe_connect_link`) is 'generic': its form (PaymentOption) has no
 * key fields. redesign bugs C: main's `isDataTemplateRequired` (`!data_template`) asked it for data no field can give,
 * so turning it on opened «fill the data» and never turned it on; it needs no credentials now, and turns on like cash.
 */
export const getGatewayKind = (paymethod) => {
  const gateway = paymethod?.gateway
  if (GLOBAL_GATEWAYS.includes(gateway)) return 'global'
  if (FIXED_KEY_GATEWAYS.includes(gateway)) return 'fixed'
  if (NO_KEY_GATEWAYS.includes(gateway)) return 'none'
  if (isTemplated(paymethod)) return 'template'
  return 'generic'
}

const templateHasRequired = (paymethod) => {
  const template = paymethod?.data_template
  return Array.isArray(template) && template.some(field => field?.required)
}

export const needsCredentials = (paymethod) => {
  const kind = getGatewayKind(paymethod)
  if (kind === 'global' || kind === 'fixed') return true
  if (kind === 'template') return templateHasRequired(paymethod)
  return false
}

const GLOBAL_KEYS = {
  stripe: ['stripe_publishable', 'stripe_publishable_sandbox', 'stripe_secret', 'stripe_secret_sandbox'],
  global_apple_pay: ['global_apple_pay_publishable', 'global_apple_pay_publishable_sandbox', 'global_apple_pay_secret', 'global_apple_pay_secret_sandbox'],
  global_google_pay: ['global_google_pay_publishable', 'global_google_pay_publishable_sandbox', 'global_google_pay_secret', 'global_google_pay_secret_sandbox'],
  computop: ['computop_merchant_id', 'computop_blowfish_password', 'computop_hmac_password']
}

// same rules as `getUtils().paymentsGlobalConfigs` (utils.js), without hooks
export const isGlobalKeysMissing = (gateway, configs) => {
  const keys = GLOBAL_KEYS[gateway]
  if (!keys) return false
  return keys.some(key => !configs?.[key]?.value)
}

// same rule as `checkBusinessPaymethodConfigs` (utils.js)
export const isDataMissing = (businessPaymethod) => (
  !businessPaymethod?.data || Object.values(businessPaymethod.data).some(value => value === null || value === '')
)

export const hasMissingCredentials = (paymethod, businessPaymethod, configs) => {
  if (!needsCredentials(paymethod)) return false
  if (getGatewayKind(paymethod) === 'global') return isGlobalKeysMissing(paymethod?.gateway, configs)
  return !businessPaymethod || isDataMissing(businessPaymethod)
}

// owner decision 5 C (W1): the check above (the one that blocks, as on main) reads Live only. A gateway in Sandbox mode with
// its Live data complete and a gap in `data_sandbox` is not blocked: it turns on and the list warns with the Sandbox fields it lacks.
// Global gateways already check both modes (`isGlobalKeysMissing`) and Stripe Connect has no Sandbox keys of its own.
const NO_SANDBOX_KEYS_GATEWAYS = ['stripe_connect']

// the controller sends `data_sandbox` stringified: parse it, and treat what does not parse as empty
const parseKeyValues = (value) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch (error) {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

const isEmptyValue = (value) => value === null || value === undefined || value === ''

// 'client_id' -> 'Client ID': the labels of the forms are not reachable from here, so the key is made readable
export const humanizeFieldKey = (key) => String(key || '')
  .split('_')
  .filter(Boolean)
  .map(word => (word.toLowerCase() === 'id' ? 'ID' : word.charAt(0).toUpperCase() + word.slice(1)))
  .join(' ')

/**
 * Keys of the Sandbox data a record in Sandbox mode lacks while its Live data is complete. `[]` when there is nothing to warn about.
 * An empty or absent `data_sandbox` names the Live keys (the form asks for the same fields in both modes).
 */
export const getMissingSandboxFields = (paymethod, businessPaymethod) => {
  if (!businessPaymethod?.sandbox) return []
  if (!needsCredentials(paymethod)) return []
  const kind = getGatewayKind(paymethod)
  if (kind === 'global' || NO_SANDBOX_KEYS_GATEWAYS.includes(paymethod?.gateway)) return []
  if (isDataMissing(businessPaymethod)) return []
  // W1 review F5: the Live keys and the Sandbox keys together, so a partial `data_sandbox` still names what it lacks (and a Live
  // `data` sent as a string gives its keys, not its characters)
  const sandbox = parseKeyValues(businessPaymethod.data_sandbox)
  const keys = [...new Set([...Object.keys(parseKeyValues(businessPaymethod.data)), ...Object.keys(sandbox)])]
  return keys.filter(key => isEmptyValue(sandbox[key]))
}

const isContactBlocked = (paymethod, isAdmin, configs) => (
  getGatewayKind(paymethod) === 'global' && isGlobalKeysMissing(paymethod?.gateway, configs) && !isAdmin
)

/**
 * What the list must do when a row's switch is flipped to `next`.
 * - block (min | contact), confirm-off, open (data), create-open, create, toggle (with `warnSandbox`: Sandbox keys to warn about)
 */
export const getToggleDecision = ({ paymethod, businessPaymethod, next, enabledCount, isAdmin, configs }) => {
  const isEnabled = !!businessPaymethod?.enabled
  if (next === false && isEnabled && enabledCount < 2) return { type: 'block', reason: 'min' }
  if (isContactBlocked(paymethod, isAdmin, configs)) return { type: 'block', reason: 'contact' }
  if (next === false && isEnabled) return { type: 'confirm-off' }
  if (next === true && businessPaymethod && hasMissingCredentials(paymethod, businessPaymethod, configs)) {
    return { type: 'open', reason: 'data' }
  }
  if (next === true && !businessPaymethod) {
    return needsCredentials(paymethod) ? { type: 'create-open' } : { type: 'create' }
  }
  if (next === true && businessPaymethod) {
    const warnSandbox = getMissingSandboxFields(paymethod, businessPaymethod)
    if (warnSandbox.length > 0) return { type: 'toggle', warnSandbox }
  }
  return { type: 'toggle' }
}

/**
 * Rows «Select all» turns on: the ones the list shows that are real (not catalog rows), not on yet and not blocked.
 */
export const getSelectAllPlan = ({ paymethods, businessPaymethods, isAdmin, configs }) => {
  const targets = []
  let missingCredentials = 0
  for (const paymethod of paymethods || []) {
    if (!paymethod || paymethod.installState || paymethod.id === undefined || paymethod.id === null) continue
    const businessPaymethod = (businessPaymethods || []).find(item => item.paymethod_id === paymethod.id)
    if (businessPaymethod?.enabled) continue
    if (isContactBlocked(paymethod, isAdmin, configs)) continue
    targets.push(paymethod.id)
    if (hasMissingCredentials(paymethod, businessPaymethod, configs)) missingCredentials += 1
  }
  return { targets, missingCredentials }
}

// G4-21: the API gives sites/devices as objects, the save wants ids
export const normalizeIds = (list) => (list || [])
  .map(item => (item && typeof item === 'object') ? item.id : item)
  .filter(value => value !== undefined && value !== null)

export const isSecretField = (field) => field?.type === 'password' || /secret|token|password|private|hmac|aes/i.test(field?.key || '')
