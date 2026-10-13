import data from './storeOnboardingRegionalData.json'

const value = (configs, key) => configs[key]?.value
const blank = value => value == null || (typeof value === 'string' && !value.trim())
const countryCode = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value.toUpperCase()) && (Object.hasOwn(data.currencies, value.toUpperCase()) || data.countriesWithoutUniqueCurrency.includes(value.toUpperCase())) ? value.toUpperCase() : null

export const regionalDefaults = (configs, countries = []) => {
  const configured = countries.filter(c => c?.enabled === true && countryCode(c.code))
  const country = countryCode(value(configs, 'default_country_code')) || countryCode(value(configs, 'country_autocomplete')) || (configured.length === 1 ? countryCode(configured[0].code) : null)
  if (!country) return {}
  const currency = value(configs, 'stripe_currency') || data.currencies[country]
  const defaults = { default_country_code: country, distance_unit: data.milesCountries.includes(country) ? 'mi' : 'km' }
  if (!currency) return defaults
  try {
    const locale = new Intl.Locale(`und-${country}`).maximize().toString()
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    const parts = formatter.formatToParts(12345.67)
    const symbol = parts.find(p => p.type === 'currency')?.value
    Object.assign(defaults, {
      stripe_currency: currency,
      format_number_currency: symbol,
      currency_position: parts.findIndex(p => p.type === 'currency') < parts.findIndex(p => p.type === 'integer') ? 'left' : 'right',
      format_number_decimal_length: String(formatter.resolvedOptions().maximumFractionDigits),
      format_number_decimal_separator: parts.find(p => p.type === 'decimal')?.value,
      format_number_thousand_separator: parts.find(p => p.type === 'group')?.value
    })
  } catch { }
  return defaults
}

export const regionalConfigUpdates = (configs, countries) => Object.entries(regionalDefaults(configs, countries)).flatMap(([key, value]) => {
  const row = configs[key]
  if (!row || row.protected || !Number.isInteger(Number(row.id)) || Number(row.id) <= 0 || !blank(row.value) || value == null) return []
  if (Array.isArray(row.options) && row.options.length && !row.options.some(option => String(option.value) === String(value))) return []
  return [{ id: row.id, key, value }]
})

export const effectiveRegionalConfigs = (configs, countries) => {
  const result = { ...configs }
  for (const update of regionalConfigUpdates(configs, countries)) result[update.key] = { ...configs[update.key], value: update.value }
  return result
}
