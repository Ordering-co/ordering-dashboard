import { parseJsonArray } from './safeJsonParse'
import { getSettingsOrderTypeValues } from './settingsAccess'
import { SETTINGS_POSITIVE_LABEL_KEYS } from './settingsConfigNames'

// redesign settings B: the option list of a type 2 config and the pure rules that decide how it is drawn.
// `getSettingsSelectOptions` is the list SettingsSelectUI built inside its effect, moved here unchanged so the legacy
// select and the Product rows (FirstSelect, Switch) read the same options. It returns plain data (`label` is already
// translated); the legacy UI wraps each label in its styled <Option>.

/** Order-type configs: their options are filtered by what the project can use. */
export const SETTINGS_ORDER_TYPE_SELECT_KEYS = [
  'filter_order_options',
  'allowed_order_types_guest_checkout',
  'default_order_type',
  'order_types_allowed',
  'unaddressed_order_types_allowed'
]

/** Order-type configs whose options are numeric (guest checkout types) instead of the type names. */
export const SETTINGS_ORDER_TYPES_BY_NUMBER_KEYS = ['order_types_allowed', 'unaddressed_order_types_allowed']

/** Configs whose Yes/No values are swapped by position (the label shown is the one that matches the stored meaning). */
export const SETTINGS_INVERTED_VALUE_KEYS = ['business_signup_enabled_default', 'driver_signup_enabled_default']

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

// a currency code (USD, MXN) is not a word to capitalize. Only the options of a currency config (its key says
// so) with a three-letter text are codes; «ALL» or «OFF» in any other config keep reading as words.
const isCurrencyCode = (configKey, raw) => /currency/i.test(String(configKey ?? '')) && /^[a-z]{3}$/i.test(raw)

// redesign (owner decision 32 A): a «Disable X» the hub names «X» (settingsConfigNames.js) reads its Yes as «No»
// and its No as «Yes»; only the label: the value of each option stays the one the API sent. `positiveLabels: false` reads them
// as stored, for a place that still shows the API name (the settings logs, settingsLogValue.js)
const POSITIVE_TEXT = { yes: 'no', no: 'yes' }
const isPositiveLabelConfig = (configKey) => SETTINGS_POSITIVE_LABEL_KEYS.includes(configKey)

const optionLabel = (t, text, configKey, positiveLabels = true) => {
  const given = String(text)
  const swapped = positiveLabels && isPositiveLabelConfig(configKey) && POSITIVE_TEXT[normalizeChoiceText(given)]
  const raw = swapped || given
  return t(raw.toUpperCase(), isCurrencyCode(configKey, raw) ? raw.toUpperCase() : capitalize(raw.toLowerCase().replace(/_/g, ' ')))
}

/**
 * @returns {Array<{ value: string, label: string, custom?: boolean }> | undefined | null}
 *   `null` without a config; `undefined` when the config has no `options` (the UI says «There is no options value»).
 */
export const getSettingsSelectOptions = ({ config, t, invertValues = false, positiveLabels = true } = {}) => {
  if (!config) return null
  let selected
  if (config.key === 'terms_and_conditions') {
    selected = [
      { value: 'true', label: t('YES', 'Yes') },
      { value: 'false', label: t('NO', 'No') }
    ]
  } else if (SETTINGS_ORDER_TYPE_SELECT_KEYS.includes(config.key)) {
    // Every order type, with no addon gate (main, unlock)
    const defaultOrderType = getSettingsOrderTypeValues()
    selected = config.options
      ?.filter(option => defaultOrderType.includes(option.value))
      .map(item => ({ value: item.value, label: optionLabel(t, item.text, config.key, positiveLabels) }))
  } else {
    selected = config.options?.map((item, i, hash) => ({
      value: invertValues ? (i === 0 ? hash[1]?.value : hash[0]?.value) : item.value,
      label: optionLabel(t, item.text, config.key, positiveLabels)
    }))
  }
  if (config.customizable && selected) {
    selected.push({ value: config.value, label: t('CUSTOM', 'Custom'), custom: true })
  }
  return selected
}

const TERMS_AND_CONDITIONS_CHOICES = [
  { text: 'yes', value: 'true' },
  { text: 'no', value: 'false' }
]

const normalizeChoiceText = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, '')

/**
 * Strict rule for drawing a type 2 config as a Switch (audit finding 2). A switch writes values, so it is only used
 * when it cannot write a wrong one: the option texts are exactly yes and no (case and spaces aside), the config is
 * not customizable, inverted, an order-type list or the country filter, and the stored value is one of the two option
 * values. «On» is the value of the `yes` option, found by its text, never by position.
 *
 * @returns {{ onValue: string, offValue: string, checked: boolean } | null} `null` means: draw the select.
 */
export const getSettingsSwitchModel = ({ config, invertValues = false } = {}) => {
  if (!config || invertValues || config.customizable) return null
  if (config.key === 'country_autocomplete' || SETTINGS_ORDER_TYPE_SELECT_KEYS.includes(config.key)) return null
  const choices = config.key === 'terms_and_conditions' ? TERMS_AND_CONDITIONS_CHOICES : config.options
  if (!Array.isArray(choices) || choices.length !== 2) return null
  const yes = choices.find(choice => normalizeChoiceText(choice?.text) === 'yes')
  const no = choices.find(choice => normalizeChoiceText(choice?.text) === 'no')
  if (!yes || !no || String(yes.value) === String(no.value)) return null
  const current = config.value == null ? null : String(config.value)
  if (current !== String(yes.value) && current !== String(no.value)) return null
  // redesign (owner decision 32 A): a «Disable X» named «X» is on when X is, that is for the stored `no`
  const [on, off] = isPositiveLabelConfig(config.key) ? [no, yes] : [yes, no]
  return { onValue: on.value, offValue: off.value, checked: current === String(on.value) }
}

/** Type 3 value (`a|b|c`) after (un)checking `optionValue`; same insertion order as the controller's handler. */
export const toggleSettingsPipeValue = (value, optionValue, checked) => {
  const current = String(value ?? '')
  const list = current === '' ? [] : current.split('|')
  const position = list.indexOf(optionValue)
  if (position === -1 && checked) list.push(optionValue)
  if (!checked && position >= 0) list.splice(position, 1)
  return list.join('|')
}

/** Type 4 value (JSON array of integers) after (un)checking `optionValue`; same insertion order as the controller. */
export const toggleSettingsJsonArrayValue = (value, optionValue, checked) => {
  const list = [...parseJsonArray(value)]
  const number = parseInt(optionValue)
  const position = list.indexOf(number)
  if (position === -1 && checked) list.push(number)
  if (!checked && position >= 0) list.splice(position, 1)
  return JSON.stringify(list)
}
