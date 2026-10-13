import { describe, it, expect } from 'vitest'
import { regionalDefaults, regionalConfigUpdates } from '../storeOnboardingRegional'

const configsFor = country => ({ country_autocomplete: { id: 1, value: country }, stripe_currency: { id: 2, value: '' }, format_number_currency: { id: 3, value: null }, distance_unit: { id: 4, value: '' }, default_country_code: { id: 5, value: '' } })
describe('first-store regional defaults', () => {
  it.each([['MX', 'MXN', '$', 'km'], ['US', 'USD', '$', 'mi'], ['CA', 'CAD', '$', 'km'], ['ES', 'EUR', '€', 'km'], ['GB', 'GBP', '£', 'mi'], ['JP', 'JPY', '￥', 'km']])('uses the actual %s project country', (country, currency, symbol, distance) => {
    const defaults = regionalDefaults(configsFor(country))
    expect(defaults.stripe_currency).toBe(currency)
    expect(defaults.format_number_currency).toBe(symbol)
    expect(defaults.distance_unit).toBe(distance)
    expect(defaults.default_country_code).toBe(country)
    expect(defaults).not.toHaveProperty('timezone')
  })
  it('preserves non-default configured currency, symbol, distance and decimal format exactly', () => {
    const configs = configsFor('MX')
    Object.assign(configs, { stripe_currency: { id: 2, value: 'USD' }, format_number_currency: { id: 3, value: 'US$' }, distance_unit: { id: 4, value: 'mi' }, format_number_decimal_length: { id: 6, value: '0' } })
    const changes = regionalConfigUpdates(configs)
    expect(changes).toEqual([{ id: 5, key: 'default_country_code', value: 'MX' }])
    expect(configs.stripe_currency.value).toBe('USD')
  })
  it('uses a single configured country, never the device location or an ambiguous project', () => {
    expect(regionalDefaults({}, [{ code: 'CA', enabled: true }]).stripe_currency).toBe('CAD')
    expect(regionalDefaults({}, [{ code: 'CA', enabled: true }, { code: 'US', enabled: true }])).toEqual({})
    expect(regionalDefaults(configsFor('*'))).toEqual({})
    expect(regionalDefaults(configsFor('ZZ'))).toEqual({})
  })
  it('does not write missing, protected or unsupported config rows', () => {
    const configs = configsFor('CA')
    delete configs.format_number_currency
    configs.stripe_currency.options = [{ value: 'USD' }]
    configs.distance_unit.protected = true
    configs.default_country_code.id = null
    expect(regionalConfigUpdates(configs)).toEqual([])
  })
  it('does not pick a currency arbitrarily in multi-currency countries', () => {
    expect(regionalDefaults(configsFor('PA'))).not.toHaveProperty('stripe_currency')
  })
  it.each(['PA', 'BT', 'HT', 'LS', 'NA', 'PS', 'ZW'])('completes country and distance for %s without choosing between currencies', country => {
    const defaults = regionalDefaults(configsFor(country))
    expect(defaults).toEqual({ default_country_code: country, distance_unit: 'km' })
    expect(regionalConfigUpdates(configsFor(country))).toEqual([{ id: 5, key: 'default_country_code', value: country }, { id: 4, key: 'distance_unit', value: 'km' }])
    const configured = configsFor(country)
    configured.stripe_currency.value = 'USD'
    expect(regionalDefaults(configured).format_number_currency).toBe(country === 'PS' ? 'US$' : '$')
    expect(regionalConfigUpdates(configured).some(update => update.key === 'stripe_currency')).toBe(false)
  })
})
