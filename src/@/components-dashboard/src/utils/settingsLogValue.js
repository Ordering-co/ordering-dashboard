import { getSettingsSelectOptions, SETTINGS_INVERTED_VALUE_KEYS } from './settingsSelectOptions'
import { parseJsonArray } from './safeJsonParse'

// redesign settings-logs (; M-SL3): a stored value of a project setting, named as the Settings hub names it, for the
// settings logs («0 → 1» reads «No → Yes»). Same helpers and the same rules as the hub's rows (ProductSettingsRow):
// - type 2 (a choice): the label `getSettingsSelectOptions` gives that value (without its «Custom» entry, which carries today's value),
//   with the hub's inversion for the inverted keys, and only when they have exactly two options;
// - type 3 (a `a|b|c` list): each part by its option's text, translated as the hub's checkboxes do;
// - type 4 (a JSON list of ids, not driver_tip_options): each id by its option's text, as the hub shows it.
// Anything the options do not name (a free value, a custom one, an option that no longer exists, a value two options share, other
// types) stays as stored:
// the label is never guessed. The log carries the setting's options as they are today.

const pipeLabel = (t, text) => t(String(text).toUpperCase(), String(text).replace(/_/g, ' ').toLowerCase())

// review R1 H4: the one option with that value, or none when there is none or more than one (a pick among several is a guess)
const onlyOption = (options, value) => {
  const hits = options.filter(item => String(item?.value) === String(value))
  return hits.length === 1 ? hits[0] : null
}

/**
 * @param {{ config?: object, value: any, t: Function }} args
 * @returns {string | null} the value to show; `null` when there is none (the caller says «None»)
 */
export const describeSettingValue = ({ config, value, t }) => {
  if (value == null || value === '') return null
  if (typeof value === 'object') return null // not a setting's stored value: the caller formats it
  const raw = String(value)
  const options = Array.isArray(config?.options) ? config.options : null
  if (!config || !options || options.length === 0) return raw

  if (config.type === 2) {
    const invertValues = SETTINGS_INVERTED_VALUE_KEYS.includes(config.key)
    // the hub's inversion swaps the first two options by position: with any other count it would name the opposite value
    if (invertValues && options.length !== 2) return raw
    if (!onlyOption(options, raw)) return raw
    // redesign (decision 32 A, review finding 1): the log names the setting as the API does («Disabled rewards»), so
    // a «Disable X» reads its value as stored, not with the hub's positive labels
    const list = getSettingsSelectOptions({ config: { ...config, customizable: false }, t, invertValues, positiveLabels: false })
    const hit = list?.find(option => String(option.value) === raw)
    return hit ? hit.label : raw
  }

  if (config.type === 3) {
    const parts = raw.split('|')
    return parts.map(part => {
      const option = onlyOption(options, part)
      return option?.text ? pipeLabel(t, option.text) : part
    }).join(', ')
  }

  if (config.type === 4 && config.key !== 'driver_tip_options') {
    const ids = parseJsonArray(raw)
    if (ids.length === 0) return raw
    return ids.map(id => {
      const option = onlyOption(options, id)
      return option?.text ?? String(id)
    }).join(', ')
  }

  return raw
}
