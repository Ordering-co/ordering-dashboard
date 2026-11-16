// redesign stores 5.1a: the rules of the store's Information form, without React. The view (index.js) reads the
// value of a field as «the change if there is one, else what the store has», validates before it saves and names the changed
// fields in the save bar.

/** The value a field shows: the pending change, else the stored one (a cleared field is '' and stays cleared). */
export const valueOf = (changes, business, key) => (changes?.[key] !== undefined ? changes[key] : business?.[key])

/** The ribbon as it would be after a save: the stored one with the pending parts on top. */
export const effectiveRibbon = (changes, business) => ({ ...(business?.ribbon || {}), ...(changes?.ribbon || {}) })

// ---- Social networks (as in main: the store keeps `base + user`) --------------------------------------------------------------

export const SOCIAL_NETWORKS = [
  { key: 'facebook_profile', base: 'https://www.facebook.com/', labelKey: 'FACEBOOK', label: 'Facebook' },
  { key: 'instagram_profile', base: 'https://www.instagram.com/', labelKey: 'INSTAGRAM', label: 'Instagram' },
  { key: 'tiktok_profile', base: 'https://www.tiktok.com/', labelKey: 'TIK_TOK', label: 'Tik tok' },
  { key: 'pinterest_profile', base: 'https://www.pinterest.com/', labelKey: 'PINTEREST', label: 'Pinterest' },
  { key: 'whatsapp_number', base: 'https://wa.me/', labelKey: 'WHATSAPP', label: 'Whatsapp' },
  { key: 'snapchat_profile', base: 'https://www.snapchat.com/add/', labelKey: 'SNAPCHAT', label: 'Snapchat' }
]

/** The user part of what was typed or stored: the last segment of a URL (main's `convertValue`). */
export const socialHandle = (value) => {
  if (!value) return ''
  const parts = String(value).split('/')
  return parts[parts.length - 1] === '' ? (parts[parts.length - 2] ?? '') : parts[parts.length - 1]
}

/** What the store keeps for what was typed: `base + user`, or '' when the field is empty (main's `ConvertInput`). */
export const socialValue = (base, typed) => {
  const handle = socialHandle(String(typed ?? '').trim())
  return handle ? `${base}${handle}` : ''
}

// ---- Disabled reason (G2-23) -------------------------------------------------------------------------------------------------

// As in main, the value saved is the label in the language of whoever saves it (`t(key, englishDefault)`). The English defaults
// below are main's catalogue defaults, typos included («Sale Diviation», «Conection failure»): changing one changes stored data.
export const DISABLED_REASONS = [
  ['SALE_DIVIATION', 'Sale Diviation'],
  ['MOTORCYCLE_FAILURE', 'Motorcycle failure'],
  ['NO_DRIVERS', 'No drivers'],
  ['EXCESS_ORDERS', 'Excess orders'],
  ['OVEN_FAILURE', 'Oven failure'],
  ['NO_ELECTRIC_POWER', 'No electric power'],
  ['NO_GAS', 'No gas'],
  ['CONECTION_FAILURE', 'Conection failure'],
  ['NO_WATER', 'No water'],
  ['SYSTEM_FAILURE', 'System failure'],
  ['STREETS_CLOSED', 'Streets closed'],
  ['NO_SERVICE', 'No service'],
  ['UNSAFETY', 'Unsafety'],
  ['MAINTENANCE_IN_STORE', 'Maintenance in store'],
  ['RAINING', 'Raining'],
  ['STORE_EVENT', 'Store event'],
  ['PROBLEM_WITH_POWER', 'Problem with power'],
  ['DRIVER_ACCIDENT', 'Driver accident'],
  ['MAINTENANCE_SYSTEM_IN_STORE', 'Maintenance system in store'],
  ['PROBLEM_WITH_GAS', 'Problem with gas'],
  ['ROLLER_FAILURE', 'Roller failure'],
  ['WEATHER', 'Weather'],
  ['GAS_LEAK', 'Gas leak'],
  ['MANIFESTATION', 'Manifestation'],
  ['LACK_OF_STAFF', 'Lack of Staff'],
  ['MIXER_FAILURE', 'Mixer failure'],
  ['AUTOMATICS', 'Automatics'],
  ['PRODUCT_SHORTAGE', 'Product shortage'],
  ['TERMINAL_FAILURES', 'Terminal failures']
].map(([key, value]) => ({ key, value }))

/**
 * The options of the select and the one that is chosen. Each option's value is its label in the language of whoever is using the
 * dashboard (main's stored value). A value saved before, as the English default or as the label in this language, selects that
 * option (so it shows translated and is not re-sent unless the user picks another); a value no option matches stays as an option
 * of its own, so it is never lost or overwritten.
 */
export const disabledReasonOptions = (t, stored) => {
  const options = DISABLED_REASONS.map(({ key, value }) => {
    const label = t(key, value)
    return { key, value: label, label, english: value }
  })
  if (stored == null || stored === '') return { options, selected: '' }
  const match = options.find(option => option.label === stored) || options.find(option => option.english === stored)
  if (match) return { options, selected: match.value }
  return { options: [{ key: 'stored', value: stored, label: stored }, ...options], selected: stored }
}

// ---- Price level (G2-22) -----------------------------------------------------------------------------------------------------

export const priceLevels = (symbol) => {
  const mark = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : '$'
  return ['1', '2', '3', '4', '5'].map((key, index) => ({ value: key, label: mark.repeat(index + 1) }))
}

// ---- Validation --------------------------------------------------------------------------------------------------------------

const WHATSAPP = /^https:\/\/wa\.me\/\+?\d+$/
const TIKTOK = /^https:\/\/www\.tiktok\.com\/@.+$/

/**
 * `{ field: message }` for what blocks a save. The name and the ribbon are checked as they would be saved (the stored value
 * counts: 5.1a-01, a stored ribbon colour is not «missing»); the networks only when they changed, as in main.
 */
export const validateInformation = (changes = {}, business = {}, t) => {
  const errors = {}
  const name = valueOf(changes, business, 'name')
  if (!String(name ?? '').trim()) errors.name = t('BUSINESS_NAME_REQUIRED', 'Business name is required')

  const ribbon = effectiveRibbon(changes, business)
  if (ribbon.enabled) {
    const ribbonName = t('RIBBON', 'Ribbon')
    if (!String(ribbon.text ?? '').trim()) {
      errors.ribbon_text = t('VALIDATION_RIBBON_ERROR_REQUIRED', 'The _attribute_ text field is required').replace('_attribute_', ribbonName)
    }
    if (!ribbon.color) {
      errors.ribbon_color = t('VALIDATION_RIBBON_COLOR_ERROR_REQUIRED', 'The _attribute_ field is required').replace('_attribute_', t('RIBBON_COLOR', 'Ribbon color'))
    }
    if (!ribbon.shape) {
      errors.ribbon_shape = t('VALIDATION_RIBBON_SHAPE_ERROR_REQUIRED', 'The _attribute_ field is required').replace('_attribute_', t('RIBBON_SHAPE', 'Ribbon shape'))
    }
  }

  for (const { key } of SOCIAL_NETWORKS) {
    const value = changes[key]
    if (!value) continue
    // review F4: a number is checked as a number (main's message), never as a user name
    if (key === 'whatsapp_number') {
      if (!WHATSAPP.test(value)) errors[key] = t('WHATS_APP_NUMBER_NOT_VALID', 'Whatsapp number is not valid')
    } else if (/\s/.test(socialHandle(value))) {
      errors[key] = t('SOCIAL_HANDLE_NO_SPACES', 'Write the user name without spaces.')
    } else if (key === 'tiktok_profile' && !TIKTOK.test(value)) {
      errors[key] = t('TIKTOK_USERNAME_NOT_VALID', 'TikTok user name is not valid')
    }
  }
  return errors
}

/** The order the fields appear in, for the save bar's names and the first error to focus. */
export const FIELD_ORDER = [
  'header', 'logo', 'name', 'vertical', 'external_id', 'description', 'phone', 'cellphone', 'featured', 'disabled_reason',
  'price_level', 'ribbon', 'ribbon_text', 'ribbon_color', 'ribbon_shape', ...SOCIAL_NETWORKS.map(network => network.key)
]

// An empty value is the same whether the store has '' or nothing (null, undefined).
const same = (a, b) => (a == null || a === '' ? '' : a) === (b == null || b === '' ? '' : b)

/**
 * review F3: a field counts as changed only while its value differs from the store's (typing a letter and deleting it is not a
 * change; the ribbon counts when one of its pending parts differs).
 */
export const isChanged = (changes, business, key) => {
  if (!changes || !Object.prototype.hasOwnProperty.call(changes, key)) return false
  if (key === 'ribbon') {
    const pending = changes.ribbon || {}
    return Object.keys(pending).some(part => !same(pending[part], business?.ribbon?.[part]))
  }
  return !same(changes[key], business?.[key])
}

/** Names of the changed fields, in the form's order; `labelOf(key)` gives each one's visible label. */
export const changedFieldNames = (changes, labelOf, business) => FIELD_ORDER
  .filter(key => isChanged(changes, business, key))
  .map(labelOf)
  .filter(Boolean)
